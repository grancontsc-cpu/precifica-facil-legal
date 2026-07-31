import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";

import { PainelResultados } from "@/components/pricing/PainelResultados";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SimulationResult } from "@/types/pricing";

/** Realça o número por um instante sempre que ele muda. */
function useDestaque(valor: number | null) {
  const [piscando, setPiscando] = useState(false);
  useEffect(() => {
    setPiscando(true);
    const t = setTimeout(() => setPiscando(false), 450);
    return () => clearTimeout(t);
  }, [valor]);
  return piscando;
}

/**
 * Barra fixa no celular com o resultado sempre à vista.
 * Um toque abre a memória de cálculo completa.
 */
export function ResumoFlutuante({ resultado }: { resultado: SimulationResult }) {
  const preco = resultado.recomendado?.precoFinal ?? null;
  const custo = resultado.compra.custoLiquidoUnitario;
  const piscando = useDestaque(preco);
  const temErro = resultado.impossivel || resultado.issues.some((i) => i.severidade === "erro");

  return (
    <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-card/95 backdrop-blur lg:hidden">
      <Sheet>
        <SheetTrigger className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Preço de venda sugerido
            </p>
            <p
              className={cn(
                "truncate text-xl font-semibold tabular-nums transition-colors duration-300",
                temErro ? "text-destructive" : piscando ? "text-primary" : "text-foreground",
              )}
            >
              {temErro ? "Revise os dados" : formatBRL(preco)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Custo líquido
            </p>
            <p className="text-sm font-medium tabular-nums text-foreground">{formatBRL(custo)}</p>
          </div>
          <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Resultado completo</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-8">
            <PainelResultados resultado={resultado} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
