import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { GitCompareArrows } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatBRL } from "@/lib/format";
import { enviarParaCompleto, montarComparativo, type StatusParcela } from "@/lib/comparativo-modos";
import type { SimulationResult, SimulationState } from "@/types/pricing";

const ESTILO: Record<StatusParcela, string> = {
  igual: "border-border bg-muted text-muted-foreground",
  "pode-mudar": "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  "so-completo": "border-primary/30 bg-primary/10 text-primary",
};

const ROTULO: Record<StatusParcela, string> = {
  igual: "igual no completo",
  "pode-mudar": "pode mudar",
  "so-completo": "só no completo",
};

interface Props {
  state: SimulationState;
  resultado: SimulationResult;
}

/**
 * Compara, parcela a parcela, o resultado do modo rápido com o detalhamento
 * que o modo completo abre — e explica o motivo de cada diferença possível.
 */
export function ComparativoModos({ state, resultado }: Props) {
  const [aberto, setAberto] = useState(false);
  const navigate = useNavigate();
  const grupos = montarComparativo(state, resultado);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <GitCompareArrows className="size-4" aria-hidden />
          Comparar com o modo completo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Rápido x Completo, parcela a parcela</DialogTitle>
          <DialogDescription>
            Os valores abaixo são os do seu cálculo rápido. Cada linha mostra se o modo completo
            tende a alterá-la e por quê.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] pr-3">
          <div className="space-y-5">
            {grupos.map((g) => (
              <section key={g.titulo} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.titulo}
                </h3>
                <ul className="space-y-2">
                  {g.linhas.map((l) => (
                    <li key={l.id} className="rounded-lg border border-border bg-background p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">{l.rotulo}</span>
                        <span className="num-destaque text-sm font-semibold">
                          {formatBRL(l.valorRapido)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${ESTILO[l.status]}`}
                        >
                          {ROTULO[l.status]}
                        </span>
                        <span className="text-xs text-muted-foreground">{l.motivo}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => setAberto(false)}>
            Continuar no modo rápido
          </Button>
          <Button
            onClick={() => {
              enviarParaCompleto(state);
              setAberto(false);
              navigate({ to: "/simulador" });
            }}
          >
            Abrir no completo com estes dados
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
