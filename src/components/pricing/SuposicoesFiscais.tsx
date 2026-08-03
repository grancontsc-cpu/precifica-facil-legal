import { useState } from "react";
import { ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CampoNumero } from "@/components/pricing/CampoNumero";
import {
  detectarSuposicoes,
  temAjustes,
  type AjustesRapido,
  type TipoSuposicao,
} from "@/lib/suposicoes-rapido";
import type { SimulationState } from "@/types/pricing";

const ESTILO: Record<TipoSuposicao, string> = {
  faltante: "border-destructive/30 bg-destructive/10 text-destructive",
  estimado: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  informativo: "border-border bg-muted text-muted-foreground",
};

const ROTULO_TIPO: Record<TipoSuposicao, string> = {
  faltante: "não informado",
  estimado: "estimado",
  informativo: "informativo",
};

interface Props {
  /** Estado já com os ajustes aplicados (valores exibidos nos campos). */
  state: SimulationState;
  ajustes: AjustesRapido;
  onChange: (ajustes: AjustesRapido) => void;
}

/**
 * Painel do modo rápido para revisar e corrigir as premissas fiscais
 * (estimadas, informativas ou ausentes) sem sair para o modo completo.
 * O recálculo é imediato a cada ajuste.
 */
export function SuposicoesFiscais({ state, ajustes, onChange }: Props) {
  const [aberto, setAberto] = useState(false);
  const suposicoes = detectarSuposicoes(state);
  const op = state.operacao;
  const editado = temAjustes(ajustes);

  const set = (parcial: Partial<AjustesRapido>) => onChange({ ...ajustes, ...parcial });
  const mostrar = (id: string) => suposicoes.some((s) => s.id === id);
  const vendaInformativos = state.tributosVenda.filter(
    (t) => t.enabled && t.treatment === "informativo",
  );

  return (
    <Collapsible
      open={aberto}
      onOpenChange={setAberto}
      className="rounded-lg border border-border bg-background"
    >
      <CollapsibleTrigger className="flex w-full items-start gap-3 p-4 text-left">
        <SlidersHorizontal className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <span className="flex-1 space-y-1.5">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            Suposições fiscais deste cálculo
            {editado ? (
              <Badge variant="secondary" className="text-[10px]">
                ajustado
              </Badge>
            ) : null}
          </span>
          <span className="block text-xs text-muted-foreground">
            {suposicoes.length} premissa(s) podem ser corrigidas aqui mesmo — o preço recalcula na
            hora.
          </span>
          <span className="flex flex-wrap gap-1.5 pt-1">
            {suposicoes.map((s) => (
              <span
                key={s.id}
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${ESTILO[s.tipo]}`}
              >
                {s.rotulo} · {ROTULO_TIPO[s.tipo]}
              </span>
            ))}
          </span>
        </span>
        <ChevronDown
          className={`mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform ${aberto ? "rotate-180" : ""}`}
          aria-hidden
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-4 border-t border-border p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {mostrar("internaDestino") ? (
            <CampoNumero
              label="Alíquota interna do destino"
              sufixo="%"
              ajuda="Alíquota de ICMS aplicada dentro do estado de destino. Ajuste se o produto tiver alíquota específica ou redução de base."
              value={op?.aliquotaInternaDestino ?? 0}
              onChange={(v) => set({ aliquotaInternaDestino: v || null })}
            />
          ) : null}

          {mostrar("interestadual") ? (
            <CampoNumero
              label="Alíquota interestadual"
              sufixo="%"
              ajuda="4% para mercadoria importada; 7% ou 12% conforme o trajeto."
              value={op?.aliquotaInterestadual ?? 0}
              onChange={(v) => set({ aliquotaInterestadual: v || null })}
            />
          ) : null}

          {mostrar("fronteira") ? (
            <>
              <CampoNumero
                label="ICMS de fronteira informado (total)"
                prefixo="R$"
                ajuda="Se você já tem o valor da guia (DIFAL, antecipação ou ST), informe aqui para sobrepor a estimativa."
                value={op?.difalManual ?? 0}
                onChange={(v) => set({ difalManual: v || null })}
              />
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Fronteira gera crédito?
                </Label>
                <Select
                  value={
                    ajustes.creditarDifal === null ? "auto" : ajustes.creditarDifal ? "sim" : "nao"
                  }
                  onValueChange={(v) => set({ creditarDifal: v === "auto" ? null : v === "sim" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automático (pelo regime)</SelectItem>
                    <SelectItem value="sim">Sim — recupero como crédito</SelectItem>
                    <SelectItem value="nao">Não — é custo puro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}

          {mostrar("das") ? (
            <CampoNumero
              label="Alíquota efetiva do DAS"
              sufixo="%"
              ajuda="Alíquota efetiva do Simples Nacional conforme o anexo e o faturamento dos últimos 12 meses."
              value={op?.aliquotaSimples ?? 0}
              onChange={(v) => set({ aliquotaSimples: v || null })}
            />
          ) : null}

          <CampoNumero
            label="Frete e despesas de compra (total)"
            prefixo="R$"
            ajuda="Valor total do frete e demais despesas de aquisição do lote."
            value={state.produto.freteTotal}
            onChange={(v) => set({ freteTotal: v || null })}
          />

          <CampoNumero
            label="Despesas variáveis de venda"
            sufixo="%"
            ajuda="Comissão, taxa de cartão, marketplace e outros percentuais sobre o preço de venda."
            value={state.venda.outrosPercent}
            onChange={(v) => set({ despesasVariaveisPercent: v || null })}
          />
        </div>

        {vendaInformativos.length > 0 ? (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <p className="text-xs font-semibold text-foreground">
              Tributos marcados como informativos
            </p>
            {vendaInformativos.map((t) => (
              <div key={t.id} className="grid gap-3 sm:grid-cols-2 sm:items-end">
                <CampoNumero
                  label={`Alíquota — ${t.label}`}
                  sufixo="%"
                  value={t.rate}
                  onChange={(v) =>
                    set({
                      tributosVenda: {
                        ...ajustes.tributosVenda,
                        [t.id]: { ...ajustes.tributosVenda[t.id], rate: v },
                      },
                    })
                  }
                />
                <div className="flex items-center gap-2 pb-1">
                  <Switch
                    id={`considerar-${t.id}`}
                    checked={false}
                    onCheckedChange={() =>
                      set({
                        tributosVenda: {
                          ...ajustes.tributosVenda,
                          [t.id]: { ...ajustes.tributosVenda[t.id], treatment: "incluido" },
                        },
                      })
                    }
                  />
                  <Label htmlFor={`considerar-${t.id}`} className="text-xs">
                    Considerar na formação do preço
                  </Label>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {editado ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({
                aliquotaInternaDestino: null,
                aliquotaInterestadual: null,
                difalManual: null,
                creditarDifal: null,
                aliquotaSimples: null,
                freteTotal: null,
                despesasVariaveisPercent: null,
                tributosCompra: {},
                tributosVenda: {},
              })
            }
          >
            <RotateCcw className="size-4" aria-hidden />
            Voltar às premissas padrão
          </Button>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
