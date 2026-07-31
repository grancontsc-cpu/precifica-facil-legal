import { useEffect } from "react";

import { cn } from "@/lib/utils";

const CHAVE = "precifica:modo-simulador";

/** Alternador entre o modo simples (padrão) e o modo completo, com preferência lembrada. */
export function AlternadorModo({
  avancado,
  onChange,
}: {
  avancado: boolean;
  onChange: (avancado: boolean) => void;
}) {
  // Restaura a preferência do usuário depois da hidratação.
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CHAVE);
      if (guardado === "completo" && !avancado) onChange(true);
      if (guardado === "simples" && avancado) onChange(false);
    } catch {
      /* preferência de interface apenas */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const escolher = (valor: boolean) => {
    onChange(valor);
    try {
      localStorage.setItem(CHAVE, valor ? "completo" : "simples");
    } catch {
      /* preferência de interface apenas */
    }
  };

  return (
    <div
      role="group"
      aria-label="Nível de detalhe da simulação"
      className="inline-flex rounded-lg border border-border bg-background p-1"
    >
      {[
        { rotulo: "Simples", valor: false },
        { rotulo: "Completo", valor: true },
      ].map((op) => (
        <button
          key={op.rotulo}
          type="button"
          aria-pressed={avancado === op.valor}
          onClick={() => escolher(op.valor)}
          className={cn(
            "min-h-[40px] rounded-md px-4 text-sm font-medium transition-colors",
            avancado === op.valor
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {op.rotulo}
        </button>
      ))}
    </div>
  );
}
