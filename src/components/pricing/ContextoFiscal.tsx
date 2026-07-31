import { AlertTriangle, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CampoNumero } from "@/components/pricing/CampoNumero";
import { UFS } from "@/lib/aliquotas";
import { REGIMES, apuraPeloSimples, calcularFronteira } from "@/lib/pricing-engine";
import type { OperacaoFiscal, Regime } from "@/types/pricing";

/**
 * Contexto fiscal da operação: regime da empresa, estado de origem da
 * mercadoria e estado de destino. É com esses dados que o motor calcula o
 * ICMS de fronteira (DIFAL/antecipação) e decide se ele gera crédito.
 */
export function ContextoFiscal({
  operacao,
  onChange,
  onRegime,
  avancado = false,
  compacto = false,
}: {
  operacao: OperacaoFiscal;
  onChange: (patch: Partial<OperacaoFiscal>) => void;
  onRegime: (regime: Regime) => void;
  avancado?: boolean;
  compacto?: boolean;
}) {
  const fronteira = calcularFronteira(operacao);
  const simples = apuraPeloSimples(operacao.regime);
  const regimeInfo = REGIMES.find((r) => r.id === operacao.regime);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="regime">Regime tributário</Label>
          <Select value={operacao.regime} onValueChange={(v) => onRegime(v as Regime)}>
            <SelectTrigger id="regime">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REGIMES.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {regimeInfo ? (
            <p className="text-xs text-muted-foreground">{regimeInfo.descricao}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="uf-origem">Estado de origem (de onde vem)</Label>
          <Select
            value={operacao.ufOrigem || undefined}
            onValueChange={(v) => onChange({ ufOrigem: v })}
          >
            <SelectTrigger id="uf-origem">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {UFS.map((u) => (
                <SelectItem key={u.sigla} value={u.sigla}>
                  {u.sigla} — {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="uf-destino">Estado de destino (sua empresa)</Label>
          <Select
            value={operacao.ufDestino || undefined}
            onValueChange={(v) => onChange({ ufDestino: v })}
          >
            <SelectTrigger id="uf-destino">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {UFS.map((u) => (
                <SelectItem key={u.sigla} value={u.sigla}>
                  {u.sigla} — {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {simples ? (
        <CampoNumero
          label="Alíquota efetiva do DAS (%)"
          value={operacao.aliquotaSimples}
          onChange={(v) => onChange({ aliquotaSimples: v })}
          sufixo="%"
          ajuda="Use a alíquota efetiva da sua apuração do Simples, não a alíquota nominal da tabela do anexo."
        />
      ) : null}

      {!compacto ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="pr-3">
              <p className="text-sm font-medium">Mercadoria importada</p>
              <p className="text-xs text-muted-foreground">
                Usa a alíquota interestadual de produto importado.
              </p>
            </div>
            <Switch
              checked={operacao.importada}
              onCheckedChange={(v) => onChange({ importada: v })}
              aria-label="Mercadoria importada"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="pr-3">
              <p className="text-sm font-medium">Calcular ICMS de fronteira</p>
              <p className="text-xs text-muted-foreground">
                Diferencial de alíquota na entrada interestadual.
              </p>
            </div>
            <Switch
              checked={operacao.difalAtivo}
              onCheckedChange={(v) => onChange({ difalAtivo: v })}
              aria-label="Calcular ICMS de fronteira"
            />
          </div>
        </div>
      ) : null}

      {avancado && operacao.difalAtivo ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <CampoNumero
            label="Alíquota interna do destino (%)"
            value={operacao.aliquotaInternaDestino ?? 0}
            onChange={(v) => onChange({ aliquotaInternaDestino: v })}
            sufixo="%"
            ajuda="Vem da tabela vigente. Ajuste apenas se a operação tiver alíquota específica."
          />
          <CampoNumero
            label="Alíquota interestadual (%)"
            value={operacao.aliquotaInterestadual ?? 0}
            onChange={(v) => onChange({ aliquotaInterestadual: v })}
            sufixo="%"
          />
          <CampoNumero
            label="Valor de fronteira manual (R$)"
            value={operacao.difalManual ?? 0}
            onChange={(v) => onChange({ difalManual: v > 0 ? v : null })}
            ajuda="Informe o valor apurado na guia. Quando maior que zero, substitui o cálculo automático."
          />
        </div>
      ) : null}

      {operacao.difalAtivo ? (
        <Alert variant={fronteira.faltaAliquota ? "destructive" : "default"}>
          {fronteira.faltaAliquota ? (
            <AlertTriangle className="size-4" />
          ) : (
            <Info className="size-4" />
          )}
          <AlertDescription>{fronteira.explicacao}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
