import { useEffect, useId, useState } from "react";
import { HelpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { parseNumeroBR } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CampoNumeroProps {
  label: string;
  value: number;
  onChange: (valor: number) => void;
  ajuda?: string;
  prefixo?: string;
  sufixo?: string;
  className?: string;
  placeholder?: string;
}

/**
 * Campo numérico com digitação livre (aceita vírgula ou ponto).
 * O valor é normalizado antes de chegar ao estado da simulação.
 */
export function CampoNumero({
  label,
  value,
  onChange,
  ajuda,
  prefixo,
  sufixo,
  className,
  placeholder,
}: CampoNumeroProps) {
  const id = useId();
  const ajudaId = `${id}-ajuda`;
  const unidadeId = `${id}-unidade`;
  const [texto, setTexto] = useState(() => (value === 0 ? "" : String(value).replace(".", ",")));
  const [focado, setFocado] = useState(false);

  useEffect(() => {
    if (!focado) {
      setTexto(value === 0 ? "" : String(value).replace(".", ","));
    }
  }, [value, focado]);

  const unidadeTexto = prefixo === "R$" ? "Valor em reais" : sufixo === "%" ? "Valor em porcentagem" : null;
  const descritores = [unidadeTexto ? unidadeId : null, ajuda ? ajudaId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
        {ajuda ? <Ajuda texto={ajuda} rotulo={label} /> : null}
      </div>
      {unidadeTexto ? (
        <span id={unidadeId} className="sr-only">
          {unidadeTexto}
        </span>
      ) : null}
      {ajuda ? (
        <span id={ajudaId} className="sr-only">
          {ajuda}
        </span>
      ) : null}
      <div className="relative">
        {prefixo ? (
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
          >
            {prefixo}
          </span>
        ) : null}
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          aria-describedby={descritores || undefined}
          placeholder={placeholder ?? "0,00"}
          value={texto}
          onFocus={() => setFocado(true)}
          onBlur={() => {
            setFocado(false);
            setTexto(value === 0 ? "" : String(value).replace(".", ","));
          }}
          onChange={(e) => {
            const bruto = e.target.value;
            setTexto(bruto);
            onChange(parseNumeroBR(bruto));
          }}
          className={cn(
            "h-11 text-base tabular-nums",
            prefixo && "pl-10",
            sufixo && "pr-10",
          )}
        />
        {sufixo ? (
          <span
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
          >
            {sufixo}
          </span>
        ) : null}
      </div>
    </div>
  );
}


interface CampoTextoProps {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  ajuda?: string;
  placeholder?: string;
  className?: string;
}

export function CampoTexto({
  label,
  value,
  onChange,
  ajuda,
  placeholder,
  className,
}: CampoTextoProps) {
  const id = useId();
  const ajudaId = `${id}-ajuda`;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
        {ajuda ? <Ajuda texto={ajuda} rotulo={label} /> : null}
      </div>
      {ajuda ? (
        <span id={ajudaId} className="sr-only">
          {ajuda}
        </span>
      ) : null}
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        aria-describedby={ajuda ? ajudaId : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 text-base"
      />
    </div>
  );
}

/** Botão de ajuda contextual. `rotulo` identifica o campo para leitores de tela. */
export function Ajuda({ texto, rotulo }: { texto: string; rotulo?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={rotulo ? `Ajuda sobre ${rotulo}` : "Ajuda"}
          className="rounded-full text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed">{texto}</TooltipContent>

    </Tooltip>
  );
}
