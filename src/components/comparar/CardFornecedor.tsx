import { Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CampoNumero, CampoTexto } from "@/components/pricing/CampoNumero";
import { CardTributoCompra } from "@/components/pricing/CardTributoCompra";
import { REGIMES } from "@/lib/comparison-defaults";
import { formatBRL } from "@/lib/format";
import type { SupplierAlternative, SupplierComparisonRow } from "@/types/comparison";
import type { PurchaseTax } from "@/types/pricing";

interface Props {
  alternativa: SupplierAlternative;
  indice: number;
  linha?: SupplierComparisonRow;
  podeRemover: boolean;
  somenteLeitura: boolean;
  onChange: (patch: Partial<SupplierAlternative>) => void;
  onChangeTributo: (id: string, patch: Partial<PurchaseTax>) => void;
  onRemove: () => void;
}

export function CardFornecedor({
  alternativa: a,
  indice,
  linha,
  podeRemover,
  somenteLeitura,
  onChange,
  onChangeTributo,
  onRemove,
}: Props) {
  const vencedor = linha?.destaques.includes("melhorOpcao");

  return (
    <div
      className={`rounded-xl border bg-card p-4 shadow-[var(--shadow-card)] ${
        vencedor ? "border-primary ring-1 ring-primary/30" : "border-border"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Alternativa {indice + 1}</Badge>
        {vencedor ? <Badge>Melhor opção econômica</Badge> : null}
        {linha ? (
          <span className="text-xs text-muted-foreground">
            Custo líquido unitário {formatBRL(linha.custoLiquidoUnitario)}
          </span>
        ) : null}
        {podeRemover && !somenteLeitura ? (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-muted-foreground"
            onClick={onRemove}
            aria-label={`Remover alternativa ${indice + 1}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}
      </div>

      <fieldset disabled={somenteLeitura} className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoTexto
            label="Fornecedor"
            value={a.nome}
            onChange={(v) => onChange({ nome: v })}
            placeholder="Nome do fornecedor"
          />
          <CampoTexto
            label="Estado de origem (UF)"
            value={a.uf}
            onChange={(v) => onChange({ uf: v.toUpperCase().slice(0, 2) })}
            placeholder="Ex.: RJ"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Regime tributário (apenas informativo)
          </Label>
          <Select
            value={a.regime}
            onValueChange={(v) => onChange({ regime: v as SupplierAlternative["regime"] })}
          >
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REGIMES.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Não entra no cálculo — serve para registrar o contexto do fornecedor.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <CampoNumero
            label="Valor unitário"
            prefixo="R$"
            value={a.valorUnitario}
            onChange={(v) => onChange({ valorUnitario: v })}
          />
          <CampoNumero
            label="Quantidade"
            value={a.quantidade}
            onChange={(v) => onChange({ quantidade: v })}
          />
          <CampoNumero
            label="Desconto (total)"
            prefixo="R$"
            value={a.descontoTotal}
            onChange={(v) => onChange({ descontoTotal: v })}
          />
          <CampoNumero
            label="Frete (total)"
            prefixo="R$"
            value={a.freteTotal}
            onChange={(v) => onChange({ freteTotal: v })}
            ajuda="Altere o frete para encontrar o ponto em que duas alternativas ficam equivalentes."
          />
          <CampoNumero
            label="Seguro (total)"
            prefixo="R$"
            value={a.seguroTotal}
            onChange={(v) => onChange({ seguroTotal: v })}
          />
          <CampoNumero
            label="Outras despesas (total)"
            prefixo="R$"
            value={a.outrasDespesas}
            onChange={(v) => onChange({ outrasDespesas: v })}
          />
          <CampoNumero
            label="Prazo de pagamento"
            sufixo="dias"
            value={a.prazoDias}
            onChange={(v) => onChange({ prazoDias: v })}
            ajuda="Informativo para comparar condições comerciais; não altera o custo líquido."
          />
        </div>

        <Accordion type="single" collapsible>
          <AccordionItem value="tributos" className="border-border">
            <AccordionTrigger className="text-sm">
              Tributos da compra, créditos e ICMS-ST
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {a.tributos.map((t) => (
                  <CardTributoCompra
                    key={`${a.id}-${t.id}`}
                    tributo={t}
                    resultado={linha?.compra.tributos.find((r) => r.id === t.id)}
                    avancado
                    onChange={(patch) => onChangeTributo(t.id, patch)}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </fieldset>
    </div>
  );
}
