import { useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { pendentes, premissasReforma } from "@/lib/revisao-premissas";
import type { SimulationState } from "@/types/pricing";

/**
 * Antes da projeção da Reforma, destaca alíquotas e premissas de referência
 * ainda não confirmadas. A projeção aparece após a revisão.
 */
export function RevisaoPremissas({
  state,
  onConfirmar,
  children,
}: {
  state: SimulationState;
  onConfirmar: (ids: string[]) => void;
  children: ReactNode;
}) {
  const todas = premissasReforma(state);
  const abertas = pendentes(state);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [verMesmoAssim, setVerMesmoAssim] = useState(false);

  const confirmadas = new Set(state.premissasConfirmadas ?? []);
  const confirmar = (ids: string[]) => {
    const validas = new Set(todas.map((p) => p.id));
    onConfirmar([...new Set([...(state.premissasConfirmadas ?? []), ...ids])].filter((i) => validas.has(i) || !i.includes(":") ));
    setMarcadas(new Set());
  };

  if (abertas.length === 0) {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
          {todas.length} premissa(s) revisada(s) para esta projeção.
        </p>
        {children}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section
        aria-labelledby="revisao-titulo"
        className="rounded-xl border border-warning/50 bg-warning/10 p-4"
      >
        <h3 id="revisao-titulo" className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
          Revise as premissas antes da projeção
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Estes valores são referências ainda não confirmadas. Se precisar, ajuste-os nos cards de
          tributos, no contexto fiscal ou nas alíquotas por ano.
        </p>
        <ul className="mt-3 space-y-2">
          {todas.map((p) => {
            const ok = confirmadas.has(p.id);
            return (
              <li key={p.id} className="flex items-start gap-3 rounded-lg bg-card p-3">
                {ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-label="Confirmada" />
                ) : (
                  <Checkbox
                    id={`prem-${p.id}`}
                    className="mt-0.5"
                    checked={marcadas.has(p.id)}
                    onCheckedChange={(v) =>
                      setMarcadas((m) => {
                        const n = new Set(m);
                        if (v) n.add(p.id);
                        else n.delete(p.id);
                        return n;
                      })
                    }
                  />
                )}
                <label htmlFor={`prem-${p.id}`} className="text-sm">
                  <span className={ok ? "text-muted-foreground" : "font-medium"}>{p.titulo}</span>
                  {!ok && <span className="block text-muted-foreground">{p.detalhe}</span>}
                </label>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" disabled={marcadas.size === 0} onClick={() => confirmar([...marcadas])}>
            Confirmar selecionadas
          </Button>
          <Button size="sm" variant="outline" onClick={() => confirmar(abertas.map((p) => p.id))}>
            Confirmar todas e ver projeção
          </Button>
          {!verMesmoAssim && (
            <Button size="sm" variant="ghost" onClick={() => setVerMesmoAssim(true)}>
              Ver projeção com valores de referência
            </Button>
          )}
        </div>
      </section>
      {verMesmoAssim && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-warning">
            Projeção com {abertas.length} premissa(s) não confirmada(s).
          </p>
          {children}
        </div>
      )}
    </div>
  );
}
