import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Ajuda } from "./CampoNumero";
import { formatBRL, formatPercent, formatNumero } from "@/lib/format";
import type { SimulationResult } from "@/types/pricing";
import { cn } from "@/lib/utils";

function Linha({
  rotulo,
  valor,
  ajuda,
  destaque,
}: {
  rotulo: string;
  valor: string;
  ajuda?: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className={cn(
            "text-sm",
            destaque ? "font-semibold text-foreground" : "text-muted-foreground",
          )}
        >
          {rotulo}
        </span>
        {ajuda ? <Ajuda texto={ajuda} /> : null}
      </div>
      <span
        className={cn(
          "shrink-0 tabular-nums",
          destaque ? "text-base font-semibold text-foreground" : "text-sm text-foreground",
        )}
      >
        {valor}
      </span>
    </div>
  );
}

export function PainelResultados({ resultado }: { resultado: SimulationResult }) {
  const { compra, recomendado, precoMinimo } = resultado;
  const erros = resultado.issues.filter((i) => i.severidade === "erro");
  const avisos = resultado.issues.filter((i) => i.severidade === "aviso");

  return (
    <div className="space-y-4">
      {erros.length > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {erros.map((e, i) => (
                <li key={`${e.campo}-${i}`}>{e.mensagem}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {resultado.impossivel ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <AlertDescription className="text-sm">{resultado.mensagemImpossivel}</AlertDescription>
        </Alert>
      ) : null}

      {avisos.map((a, i) => (
        <Alert key={`${a.campo}-${i}`}>
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <AlertDescription className="text-sm">{a.mensagem}</AlertDescription>
        </Alert>
      ))}

      <section
        aria-label="Resumo da compra"
        className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-panel)]"
      >
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Compra
        </h3>
        <div className="mt-2 divide-y divide-border">
          <Linha
            rotulo="Desembolso total"
            valor={formatBRL(compra.desembolsoTotal)}
            ajuda="Desembolso: valor efetivamente pago ao fornecedor e demais envolvidos."
            destaque
          />
          <Linha
            rotulo="Créditos recuperáveis"
            valor={formatBRL(compra.creditosTotais)}
            ajuda="Crédito tributário: valor do imposto que poderá reduzir os tributos devidos pela empresa."
          />
          <Linha
            rotulo="Custo líquido total"
            valor={formatBRL(compra.custoLiquidoTotal)}
            ajuda="Custo líquido: desembolso menos os créditos tributários recuperáveis."
            destaque
          />
          <Linha
            rotulo="Custo líquido por unidade"
            valor={formatBRL(compra.custoLiquidoUnitario)}
            destaque
          />
        </div>
      </section>

      <section
        aria-label="Resumo da venda"
        className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-panel)]"
      >
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Venda
        </h3>
        {recomendado ? (
          <>
            <div className="mt-3 rounded-lg bg-brand-soft px-4 py-3">
              <p className="text-xs font-medium text-primary">Preço final cobrado</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-primary">
                {formatBRL(recomendado.precoFinal)}
              </p>
              <p className="mt-1 text-xs text-primary/80">
                Margem efetiva {formatPercent(recomendado.margemEfetiva)} · Resultado estimado{" "}
                {formatBRL(recomendado.resultadoUnidade)} por unidade
              </p>
            </div>
            <div className="mt-3 divide-y divide-border">
              <Linha
                rotulo="Preço mínimo sem margem"
                valor={formatBRL(precoMinimo?.precoFinal ?? 0)}
                ajuda="Preço em que o resultado estimado é zero: cobre custo, tributos e despesas variáveis."
              />
              <Linha rotulo="Preço de venda base" valor={formatBRL(recomendado.precoBase)} />
              <Linha
                rotulo="Tributos acrescentados por fora"
                valor={formatBRL(recomendado.tributosPorFora)}
              />
              <Linha
                rotulo="Tributos totais sobre a venda"
                valor={formatBRL(recomendado.tributosIncluidos + recomendado.tributosPorFora)}
              />
              {recomendado.tributosInformativos > 0 ? (
                <Linha
                  rotulo="Tributos informativos (não somados)"
                  valor={formatBRL(recomendado.tributosInformativos)}
                  ajuda="Valores apenas de referência: não alteram o preço nem o resultado."
                />
              ) : null}
              <Linha
                rotulo="Despesas variáveis"
                valor={formatBRL(recomendado.despesasVariaveis)}
                ajuda="Comissões, taxas de cartão e marketplace, perdas e outros percentuais sobre a venda."
              />
              <Linha
                rotulo="Despesas fixas por unidade"
                valor={formatBRL(recomendado.despesasFixasUnidade)}
              />
              <Linha
                rotulo="Resultado estimado por unidade"
                valor={formatBRL(recomendado.resultadoUnidade)}
                ajuda="Não é lucro líquido: não inclui todas as despesas fixas, IRPJ e CSLL."
                destaque
              />
              <Linha
                rotulo="Margem de contribuição"
                valor={formatPercent(recomendado.margemEfetiva)}
                ajuda="Margem: percentual que sobra da venda depois do custo do produto, tributos e despesas variáveis."
                destaque
              />
              <Separator className="my-1" />
              <Linha
                rotulo="Markup multiplicador"
                valor={`${formatNumero(recomendado.markupMultiplicador)}×`}
                ajuda="Preço final ÷ custo líquido unitário."
              />
              <Linha
                rotulo="Markup percentual"
                valor={formatPercent(recomendado.markupPercentual)}
                ajuda="[(preço final ÷ custo líquido unitário) − 1] × 100."
              />
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Preencha os campos obrigatórios e corrija os avisos para ver o preço recomendado.
          </p>
        )}
      </section>
    </div>
  );
}
