import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CampoNumero, Ajuda } from "./CampoNumero";
import { formatBRL } from "@/lib/format";
import type { PurchaseTax, PurchaseTaxResult } from "@/types/pricing";

const AJUDA_TRATAMENTO =
  "Incluído: o tributo já está dentro do valor informado. Acrescentado por fora: é somado ao que você paga. Apenas informativo: aparece no cálculo, mas não muda desembolso nem custo.";
const AJUDA_CREDITO =
  "Crédito tributário: valor do imposto que poderá reduzir os tributos devidos pela empresa. Ter o tributo destacado não significa automaticamente ter direito ao crédito.";

interface Props {
  tributo: PurchaseTax;
  resultado?: PurchaseTaxResult;
  avancado: boolean;
  onChange: (patch: Partial<PurchaseTax>) => void;
}

export function CardTributoCompra({ tributo, resultado, avancado, onChange }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate text-sm font-semibold text-foreground">{tributo.label}</h4>
            <Ajuda texto={tributo.descricao} />
            {tributo.enabled ? (
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                {tributo.treatment === "incluido"
                  ? "Incluído"
                  : tributo.treatment === "porFora"
                    ? "Por fora"
                    : "Informativo"}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Label htmlFor={`sw-${tributo.id}`} className="sr-only">
            Ativar {tributo.label}
          </Label>
          <Switch
            id={`sw-${tributo.id}`}
            checked={tributo.enabled}
            onCheckedChange={(v) => onChange({ enabled: v })}
          />
        </div>
      </div>

      {tributo.enabled ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoNumero
              label="Alíquota"
              sufixo="%"
              value={tributo.rate}
              onChange={(v) => onChange({ rate: v })}
              ajuda="Percentual do tributo. A alíquota é independente do direito ao crédito."
            />
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Tratamento no preço
                </Label>
                <Ajuda texto={AJUDA_TRATAMENTO} />
              </div>
              <Select
                value={tributo.treatment}
                onValueChange={(v) => onChange({ treatment: v as PurchaseTax["treatment"] })}
              >
                <SelectTrigger className="h-11" aria-label={`Tratamento de ${tributo.label}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="incluido">Incluído no valor informado</SelectItem>
                  <SelectItem value="porFora">Acrescentado por fora</SelectItem>
                  <SelectItem value="informativo">Apenas informativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Gera crédito</Label>
                <Ajuda texto={AJUDA_CREDITO} />
              </div>
              <Select
                value={tributo.creditMode}
                onValueChange={(v) => onChange({ creditMode: v as PurchaseTax["creditMode"] })}
              >
                <SelectTrigger className="h-11" aria-label={`Crédito de ${tributo.label}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao">Não gera crédito</SelectItem>
                  <SelectItem value="integral">Crédito integral</SelectItem>
                  <SelectItem value="parcial">Crédito parcial</SelectItem>
                  <SelectItem value="manual">Valor manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {tributo.creditMode === "parcial" ? (
              <CampoNumero
                label="Percentual de crédito"
                sufixo="%"
                value={tributo.creditPercent}
                onChange={(v) => onChange({ creditPercent: v })}
                ajuda="Parte do tributo que efetivamente vira crédito."
              />
            ) : null}
            {tributo.creditMode === "manual" ? (
              <CampoNumero
                label="Crédito informado"
                prefixo="R$"
                value={tributo.creditManual}
                onChange={(v) => onChange({ creditManual: v })}
                ajuda="Valor do crédito conforme apuração da contabilidade."
              />
            ) : null}
          </div>

          {avancado ? (
            <div className="space-y-4 rounded-md bg-surface p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Base de cálculo
                  </Label>
                  <Select
                    value={tributo.baseMode}
                    onValueChange={(v) => onChange({ baseMode: v as PurchaseTax["baseMode"] })}
                  >
                    <SelectTrigger className="h-11" aria-label={`Base de ${tributo.label}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="padrao">Valor dos produtos após desconto</SelectItem>
                      <SelectItem value="manual">Base informada manualmente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {tributo.baseMode === "manual" ? (
                  <CampoNumero
                    label="Base informada"
                    prefixo="R$"
                    value={tributo.baseManual}
                    onChange={(v) => onChange({ baseManual: v })}
                  />
                ) : null}
                <CampoNumero
                  label="Redução de base"
                  sufixo="%"
                  value={tributo.baseReduction}
                  onChange={(v) => onChange({ baseReduction: v })}
                  ajuda="Percentual de redução da base previsto na legislação aplicável ao produto."
                />
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id={`manual-${tributo.id}`}
                  checked={tributo.useManualTax}
                  onCheckedChange={(v) => onChange({ useManualTax: v })}
                />
                <Label htmlFor={`manual-${tributo.id}`} className="text-xs text-muted-foreground">
                  Informar o valor destacado na nota
                </Label>
              </div>
              {tributo.useManualTax ? (
                <CampoNumero
                  label="Valor destacado na nota"
                  prefixo="R$"
                  value={tributo.manualTaxValue}
                  onChange={(v) => onChange({ manualTaxValue: v })}
                />
              ) : null}

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Observação</Label>
                <Textarea
                  value={tributo.note}
                  onChange={(e) => onChange({ note: e.target.value })}
                  rows={2}
                  placeholder="Ex.: crédito confirmado pela contabilidade em 12/2026."
                />
              </div>
            </div>
          ) : null}

          {resultado ? (
            <dl className="grid grid-cols-2 gap-2 rounded-md bg-surface-strong px-3 py-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Valor do tributo</dt>
                <dd className="font-semibold tabular-nums text-foreground">
                  {formatBRL(resultado.valor)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Crédito recuperável</dt>
                <dd className="font-semibold tabular-nums text-foreground">
                  {formatBRL(resultado.credito)}
                </dd>
              </div>
              {avancado ? (
                <div className="col-span-2 text-[11px] text-muted-foreground">
                  {resultado.origemValor} · {resultado.origemCredito}
                </div>
              ) : null}
            </dl>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
