import { Check, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { avaliarSenha } from "@/lib/senha";
import { cn } from "@/lib/utils";

/**
 * Lista de critérios que fica verde conforme o usuário digita,
 * com barra de força. Apenas apresentação — regras vivem em @/lib/senha.
 *
 * Acessibilidade:
 * - grupo focalizável pelo teclado (Tab), com rótulo e indicador de foco visível;
 * - barra exposta como role="progressbar" com aria-valuetext em português;
 * - mudanças anunciadas por leitores de tela via região aria-live (com atraso,
 *   para não interromper a digitação a cada tecla).
 */
export function ForcaSenha({
  senha,
  className,
  id,
}: {
  senha: string;
  className?: string;
  id?: string;
}) {
  const autoId = useId();
  const grupoId = id ?? `forca-senha-${autoId}`;
  const { criterios, atendidos, total, valida } = avaliarSenha(senha);
  const proporcao = atendidos / total;

  const nivel = valida
    ? { texto: "Senha forte", cor: "text-success", barra: "bg-success" }
    : proporcao >= 0.6
      ? { texto: "Senha média", cor: "text-warning", barra: "bg-warning" }
      : { texto: "Senha fraca", cor: "text-destructive", barra: "bg-destructive" };

  const faltando = criterios.filter((c) => !c.ok).map((c) => c.rotulo.toLowerCase());
  const resumo = !senha
    ? ""
    : valida
      ? "Senha forte: todos os critérios atendidos."
      : `${nivel.texto}. ${atendidos} de ${total} critérios atendidos. Falta: ${faltando.join("; ")}.`;

  // Anúncio com atraso: evita ler cada tecla digitada.
  const [anuncio, setAnuncio] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAnuncio(resumo), 700);
    return () => clearTimeout(timer.current);
  }, [resumo]);

  return (
    <div
      id={grupoId}
      role="group"
      tabIndex={0}
      aria-label="Requisitos e força da senha"
      className={cn(
        "space-y-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div
          role="progressbar"
          aria-label="Força da senha"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={atendidos}
          aria-valuetext={senha ? `${nivel.texto}: ${atendidos} de ${total} critérios atendidos` : "Senha vazia"}
          className="h-1.5 w-full overflow-hidden rounded-full bg-surface-strong"
        >
          <div
            className={cn("h-full rounded-full transition-all duration-300", senha ? nivel.barra : "bg-transparent")}
            style={{ width: `${Math.round(proporcao * 100)}%` }}
          />
        </div>
        <span aria-hidden className={cn("shrink-0 text-xs font-semibold", senha ? nivel.cor : "text-muted-foreground")}>
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
            <span>
              {c.rotulo}
              <span className="sr-only">{c.ok ? " — atendido" : " — pendente"}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {anuncio}
      </p>
    </div>
  );
}
