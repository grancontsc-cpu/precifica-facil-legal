import { CheckCircle2, Circle, Sparkles, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { etapasPreenchimento, type EtapaPreenchimento } from "@/lib/progresso-simulacao";
import { cn } from "@/lib/utils";
import type { SimulationState } from "@/types/pricing";

/**
 * Mostra o quanto da simulação já foi preenchido e leva o usuário direto
 * à próxima seção, para incentivar o preenchimento completo.
 */
export function GuiaPreenchimento({
  state,
  doRapido,
  onIr,
  onFecharBoasVindas,
}: {
  state: SimulationState;
  doRapido: boolean;
  onIr: (etapa: EtapaPreenchimento) => void;
  onFecharBoasVindas: () => void;
}) {
  const etapas = etapasPreenchimento(state);
  const feitas = etapas.filter((e) => e.feito).length;
  const pct = Math.round((feitas / etapas.length) * 100);
  const proxima = etapas.find((e) => !e.feito);

  return (
    <section
      aria-label="Progresso do preenchimento"
      className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
    >
      {doRapido ? (
        <div className="flex items-start gap-2 rounded-lg bg-card p-3 text-sm">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p className="flex-1">
            <strong>Trouxemos tudo o que você preencheu no modo rápido.</strong> Agora é só
            completar os detalhes abaixo para chegar ao preço exato — nada precisa ser digitado
            de novo.
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Fechar aviso"
            onClick={onFecharBoasVindas}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">
          {feitas === etapas.length
            ? "Simulação completa — preço com máxima precisão"
            : `Sua precificação está ${pct}% completa`}
        </p>
        <span className="text-xs text-muted-foreground">
          {feitas} de {etapas.length}
        </span>
      </div>
      <Progress value={pct} aria-label={`${pct}% preenchido`} />

      <ul className="grid gap-1.5 sm:grid-cols-2">
        {etapas.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onIr(e)}
              className={cn(
                "flex w-full items-start gap-2 rounded-md p-2 text-left text-sm transition-colors hover:bg-card",
                e === proxima && "bg-card ring-1 ring-primary/40",
              )}
            >
              {e.feito ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span>
                <span className={cn("block", e.feito && "text-muted-foreground")}>
                  {e.rotulo}
                  <span className="sr-only">{e.feito ? " (concluído)" : " (pendente)"}</span>
                </span>
                {!e.feito ? (
                  <span className="block text-xs text-muted-foreground">{e.dica}</span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {proxima ? (
        <Button size="sm" onClick={() => onIr(proxima)}>
          Continuar: {proxima.rotulo}
        </Button>
      ) : null}
    </section>
  );
}
