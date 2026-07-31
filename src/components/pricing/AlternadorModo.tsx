import { useEffect } from "react";

import { cn } from "@/lib/utils";

const CHAVE = "precifica:modo-simulador";

/** Níveis de detalhe do simulador. */
export type ModoSimulador = "rapido" | "simples" | "completo";

const MODOS: Array<{ id: ModoSimulador; rotulo: string }> = [
  { id: "rapido", rotulo: "Rápido" },
  { id: "simples", rotulo: "Simples" },
  { id: "completo", rotulo: "Completo" },
];

export const DESCRICAO_MODO: Record<ModoSimulador, string> = {
  rapido:
    "Modo rápido: produto, valor, de onde vem e para onde vai. O resultado é aproximado e serve para uma primeira leitura.",
  simples:
    "Modo simples: preencha o que comprou, o quanto pagou e a margem desejada. O restante segue o perfil tributário da empresa.",
  completo: "Modo completo: todos os detalhes de cada tributo ficam abertos para edição.",
};

export function modoValido(valor: string | null): ModoSimulador | null {
  return MODOS.some((m) => m.id === valor) ? (valor as ModoSimulador) : null;
}

/** Alternador entre os modos rápido, simples e completo, com preferência lembrada. */
export function AlternadorModo({
  modo,
  onChange,
}: {
  modo: ModoSimulador;
  onChange: (modo: ModoSimulador) => void;
}) {
  // Restaura a preferência do usuário depois da hidratação.
  useEffect(() => {
    try {
      const guardado = modoValido(localStorage.getItem(CHAVE));
      if (guardado && guardado !== modo) onChange(guardado);
    } catch {
      /* preferência de interface apenas */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const escolher = (valor: ModoSimulador) => {
    onChange(valor);
    try {
      localStorage.setItem(CHAVE, valor);
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
      {MODOS.map((op) => (
        <button
          key={op.id}
          type="button"
          aria-pressed={modo === op.id}
          onClick={() => escolher(op.id)}
          className={cn(
            "min-h-[40px] rounded-md px-4 text-sm font-medium transition-colors",
            modo === op.id
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
