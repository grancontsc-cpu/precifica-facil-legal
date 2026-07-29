import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CampoNumero, Ajuda } from "./CampoNumero";
import { formatBRL } from "@/lib/format";
import type { SaleTax, SaleTaxResult } from "@/types/pricing";

interface Props {
  tributo: SaleTax;
  resultado?: SaleTaxResult;
  avancado: boolean;
  onChange: (patch: Partial<SaleTax>) => void;
}

export function CardTributoVenda({ tributo, resultado, avancado, onChange }: Props) {
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
        <Switch
          aria-label={`Ativar ${tributo.label} na venda`}
          checked={tributo.enabled}
          onCheckedChange={(v) => onChange({ enabled: v })}
        />
      </div>

      {tributo.enabled ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoNumero
              label="Alíquota"
              sufixo="%"
              value={tributo.rate}
              onChange={(v) => onChange({ rate: v })}
            />
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Tratamento no preço
                </Label>
                <Ajuda texto="Incluído: já está dentro do preço de venda. Acrescentado por fora: soma ao preço cobrado do cliente. Informativo: não altera o preço nem o resultado." />
              </div>
              <Select
                value={tributo.treatment}
                onValueChange={(v) => onChange({ treatment: v as SaleTax["treatment"] })}
              >
                <SelectTrigger className="h-11" aria-label={`Tratamento de ${tributo.label}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="incluido">Incluído no preço</SelectItem>
                  <SelectItem value="porFora">Acrescentado por fora</SelectItem>
                  <SelectItem value="informativo">Apenas informativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {avancado ? (
            <div className="grid gap-3 rounded-md bg-surface p-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Base de cálculo</Label>
                <Select
                  value={tributo.baseMode}
                  onValueChange={(v) => onChange({ baseMode: v as SaleTax["baseMode"] })}
                >
                  <SelectTrigger className="h-11" aria-label={`Base de ${tributo.label} na venda`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="padrao">Preço base da venda</SelectItem>
                    <SelectItem value="manual">Base fixa por unidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {tributo.baseMode === "manual" ? (
                <CampoNumero
                  label="Base por unidade"
                  prefixo="R$"
                  value={tributo.baseManual}
                  onChange={(v) => onChange({ baseManual: v })}
                />
              ) : null}
            </div>
          ) : null}

          {resultado ? (
            <p className="rounded-md bg-surface-strong px-3 py-2 text-xs text-muted-foreground">
              Valor por unidade:{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {formatBRL(resultado.valor)}
              </span>{" "}
              (base {formatBRL(resultado.base)} × {tributo.rate}%)
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
