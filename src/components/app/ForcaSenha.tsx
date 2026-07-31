import { Check, X } from "lucide-react";

import { avaliarSenha } from "@/lib/senha";
import { cn } from "@/lib/utils";

/**
 * Lista de critérios que fica verde conforme o usuário digita,
 * com barra de força. Apenas apresentação — regras vivem em @/lib/senha.
 */
export function ForcaSenha({ senha, className }: { senha: string; className?: string }) {
  const { criterios, atendidos, total, valida } = avaliarSenha(senha);
  const proporcao = atendidos / total;

  const nivel = valida
    ? { texto: "Senha forte", cor: "text-success", barra: "bg-success" }
    : proporcao >= 0.6
      ? { texto: "Senha média", cor: "text-warning", barra: "bg-warning" }
      : { texto: "Senha fraca", cor: "text-destructive", barra: "bg-destructive" };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-strong">
          <div
            className={cn("h-full rounded-full transition-all duration-300", senha ? nivel.barra : "bg-transparent")}
            style={{ width: `${Math.round(proporcao * 100)}%` }}
          />
        </div>
        <span className={cn("shrink-0 text-xs font-semibold", senha ? nivel.cor : "text-muted-foreground")}>
          {senha ? nivel.texto : "—"}
        </span>
      </div>

      <ul className="grid gap-1">
        {criterios.map((c) => (
          <li
            key={c.id}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors",
              c.ok ? "text-success" : "text-muted-foreground",
            )}
          >
            {c.ok ? (
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <X className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
            )}
            <span>{c.rotulo}</span>
          </li>
        ))}
      </ul>
      <p className="sr-only" aria-live="polite">
        {atendidos} de {total} critérios de senha atendidos.
      </p>
    </div>
  );
}
