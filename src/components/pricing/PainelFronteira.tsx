import { Info, ShieldCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatPercent } from "@/lib/format";
import { calcularFronteira, creditaFronteiraPorRegime, nomeRegime } from "@/lib/pricing-engine";
import type { SimulationResult, SimulationState } from "@/types/pricing";
import { cn } from "@/lib/utils";

/**
 * Painel de transparência: mostra como o ICMS de fronteira (DIFAL /
 * antecipação / ICMS-ST) foi tratado para o regime da empresa e o que ainda
 * pode mudar quando o usuário refinar os dados no modo completo.
 *
 * Componente puramente de apresentação: todos os números vêm do motor.
 */
export function PainelFronteira({
  state,
  resultado,
  compacto = false,
}: {
  state: SimulationState;
  resultado: SimulationResult;
  compacto?: boolean;
}) {
  const op = state.operacao;
  if (!op) return null;

  const regime = op.regime;
  const fronteira = calcularFronteira(op);
  const linha = resultado.compra.tributos.find((t) => t.id === "icmsFronteira");
  const creditavel = op.creditarDifal ?? creditaFronteiraPorRegime(regime);
  const valor = linha?.valor ?? 0;
  const credito = linha?.credito ?? 0;
  const custoPuro = Math.max(0, valor - credito);
  const manual = typeof op.difalManual === "number" && op.difalManual > 0;

  const trajeto =
    op.ufOrigem && op.ufDestino
      ? `${op.ufOrigem.toUpperCase()} → ${op.ufDestino.toUpperCase()}`
      : "Trajeto não informado";

  return (
    <section
      aria-label="Como o ICMS de fronteira foi tratado"
      className="rounded-xl border border-border bg-surface p-4"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          ICMS de fronteira / ICMS-ST no seu regime
        </h3>
        <Badge variant="outline">{nomeRegime(regime)}</Badge>
        <Badge variant="outline">{trajeto}</Badge>
        <Badge variant={creditavel ? "secondary" : "destructive"}>
          {creditavel ? "Recuperável (crédito)" : "Custo puro do produto"}
        </Badge>
      </header>

      <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
        {creditavel ? (
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        ) : (
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        )}
        <span>
          {creditavel
            ? "No Lucro Real e no Lucro Presumido o ICMS de fronteira pago na entrada é recuperável: ele entra como desembolso e volta como crédito, sem inflar o custo líquido do produto."
            : "No Simples Nacional e no MEI o ICMS de fronteira não gera crédito: o valor recolhido é custo puro e foi somado ao custo líquido da mercadoria antes da margem."}
          {op.creditarDifal !== null
            ? " Este comportamento foi ajustado manualmente e sobrepõe a regra padrão do regime."
            : ""}
        </span>
      </p>

      {!compacto ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-background p-3">
            <dt className="text-xs text-muted-foreground">Alíquota aplicada</dt>
            <dd className="num-destaque text-base font-semibold text-foreground">
              {manual ? "Valor informado" : formatPercent(fronteira.rate)}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-background p-3">
            <dt className="text-xs text-muted-foreground">Desembolso na entrada</dt>
            <dd className="num-destaque text-base font-semibold text-foreground">
              {formatBRL(valor)}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-background p-3">
            <dt className="text-xs text-muted-foreground">
              {creditavel ? "Crédito recuperável" : "Custo incorporado"}
            </dt>
            <dd
              className={cn(
                "num-destaque text-base font-semibold",
                creditavel ? "text-foreground" : "text-destructive",
              )}
            >
              {formatBRL(creditavel ? credito : custoPuro)}
            </dd>
          </div>
        </dl>
      ) : null}

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{fronteira.explicacao}</p>

      <div className="mt-4 rounded-lg border border-dashed border-border p-3">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            <strong className="text-foreground">O que ainda pode mudar:</strong> o cálculo usa a
            alíquota interna geral do estado de destino e a interestadual do trajeto. Na versão
            completa você pode informar substituição tributária com MVA/pauta, redução de base,
            benefícios e regimes especiais, antecipação parcial, frete e despesas que entram na
            base, e ajustar manualmente o valor ou o direito a crédito de cada tributo. Enquanto
            isso, trate o resultado como estimativa gerencial.
          </span>
        </p>
      </div>
    </section>
  );
}
