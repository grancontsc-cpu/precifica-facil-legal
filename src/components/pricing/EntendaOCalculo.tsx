import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  eventoDetalhamentoResultado,
  type ModoAnalytics,
} from "@/lib/analytics-eventos";
import { formatBRL, formatPercent, formatQuantidade } from "@/lib/format";
import type { SimulationResult, SimulationState } from "@/types/pricing";

function LinhaMemoria({
  rotulo,
  valor,
  formula,
}: {
  rotulo: string;
  valor: string;
  formula: string;
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-3 align-top text-sm text-foreground">{rotulo}</td>
      <td className="py-2 pr-3 text-right align-top text-sm font-medium tabular-nums text-foreground">
        {valor}
      </td>
      <td className="hidden py-2 align-top text-xs text-muted-foreground sm:table-cell">
        {formula}
      </td>
    </tr>
  );
}

export function EntendaOCalculo({
  state,
  resultado,
  modo = "completo",
  comComparacao = false,
}: {
  state: SimulationState;
  resultado: SimulationResult;
  modo?: ModoAnalytics;
  comComparacao?: boolean;
}) {
  const c = resultado.compra;
  const v = resultado.recomendado;
  const q = state.produto.quantidade;

  return (
    <Accordion
      type="single"
      collapsible
      className="rounded-xl border border-border bg-card px-4"
      onValueChange={(valor) =>
        eventoDetalhamentoResultado({
          secao: "memoria_calculo",
          aberto: valor === "memoria",
          modo,
          comComparacao,
        })
      }
    >
      <AccordionItem value="memoria" className="border-0">
        <AccordionTrigger className="text-sm font-semibold">Entenda o cálculo</AccordionTrigger>
        <AccordionContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <caption className="sr-only">Memória detalhada do cálculo</caption>
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Item
                  </th>
                  <th className="py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Valor
                  </th>
                  <th className="hidden py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:table-cell">
                    Fórmula / origem
                  </th>
                </tr>
              </thead>
              <tbody>
                <LinhaMemoria
                  rotulo="Valor bruto dos produtos"
                  valor={formatBRL(c.valorBrutoProdutos)}
                  formula={`${formatBRL(state.produto.valorUnitario)} × ${formatQuantidade(q)}`}
                />
                <LinhaMemoria
                  rotulo="(−) Desconto incondicional"
                  valor={formatBRL(c.desconto)}
                  formula="Informado no formulário"
                />
                <LinhaMemoria
                  rotulo="(=) Produtos após desconto"
                  valor={formatBRL(c.valorProdutosLiquido)}
                  formula="Valor bruto − desconto (base padrão dos tributos)"
                />
                <LinhaMemoria
                  rotulo="(+) Frete, seguro, outras despesas, embalagem e rateio"
                  valor={formatBRL(c.outrosCustosAquisicao)}
                  formula="Soma dos custos de aquisição informados"
                />
                <LinhaMemoria
                  rotulo="(=) Valor base da aquisição"
                  valor={formatBRL(c.valorBaseAquisicao)}
                  formula="Produtos após desconto + demais custos"
                />

                {c.tributos
                  .filter((t) => t.enabled)
                  .map((t) => (
                    <LinhaMemoria
                      key={`t-${t.id}`}
                      rotulo={`Tributo da compra — ${t.label} (${
                        t.treatment === "incluido"
                          ? "incluído"
                          : t.treatment === "porFora"
                            ? "por fora"
                            : "informativo"
                      })`}
                      valor={formatBRL(t.valor)}
                      formula={t.origemValor}
                    />
                  ))}

                <LinhaMemoria
                  rotulo="(+) Tributos acrescentados por fora"
                  valor={formatBRL(c.tributosPorFora)}
                  formula="Somente tributos marcados como acrescentados por fora"
                />
                <LinhaMemoria
                  rotulo="Tributos incluídos (não somados novamente)"
                  valor={formatBRL(c.tributosIncluidos)}
                  formula="Já estão dentro do valor informado"
                />
                <LinhaMemoria
                  rotulo="(=) Desembolso total da compra"
                  valor={formatBRL(c.desembolsoTotal)}
                  formula="Valor base da aquisição + tributos por fora"
                />

                {c.tributos
                  .filter((t) => t.enabled && t.credito !== 0)
                  .map((t) => (
                    <LinhaMemoria
                      key={`cr-${t.id}`}
                      rotulo={`Crédito — ${t.label}`}
                      valor={formatBRL(t.credito)}
                      formula={t.origemCredito}
                    />
                  ))}

                <LinhaMemoria
                  rotulo="(−) Total de créditos recuperáveis"
                  valor={formatBRL(c.creditosTotais)}
                  formula="Soma dos créditos de cada tributo"
                />
                <LinhaMemoria
                  rotulo="(=) Custo líquido total"
                  valor={formatBRL(c.custoLiquidoTotal)}
                  formula="Desembolso total − créditos recuperáveis"
                />
                <LinhaMemoria
                  rotulo="(=) Custo líquido por unidade"
                  valor={formatBRL(c.custoLiquidoUnitario)}
                  formula={`Custo líquido total ÷ ${formatQuantidade(q)}`}
                />

                {v ? (
                  <>
                    <LinhaMemoria
                      rotulo="Preço de venda base"
                      valor={formatBRL(v.precoBase)}
                      formula={
                        state.venda.modo === "margem"
                          ? "Preço que atinge a margem desejada (busca com tolerância de R$ 0,0001)"
                          : "Derivado do preço informado, retirando os tributos por fora"
                      }
                    />
                    {v.tributos.map((t) => (
                      <LinhaMemoria
                        key={`v-${t.id}`}
                        rotulo={`Tributo da venda — ${t.label} (${
                          t.treatment === "incluido"
                            ? "incluído"
                            : t.treatment === "porFora"
                              ? "por fora"
                              : "informativo"
                        })`}
                        valor={formatBRL(t.valor)}
                        formula={`${formatBRL(t.base)} × ${t.rate}%`}
                      />
                    ))}
                    <LinhaMemoria
                      rotulo="(+) Tributos por fora na venda"
                      valor={formatBRL(v.tributosPorFora)}
                      formula="Somados ao preço cobrado do cliente"
                    />
                    <LinhaMemoria
                      rotulo="(=) Preço final cobrado"
                      valor={formatBRL(v.precoFinal)}
                      formula="Preço base + tributos acrescentados por fora"
                    />
                    <LinhaMemoria
                      rotulo="(−) Despesas variáveis"
                      valor={formatBRL(v.despesasVariaveis)}
                      formula="Preço final × (comissão + cartão + marketplace + perdas + outros)"
                    />
                    <LinhaMemoria
                      rotulo="(−) Despesas fixas por unidade"
                      valor={formatBRL(v.despesasFixasUnidade)}
                      formula="Frete de venda + embalagem + rateio de custo fixo + outras"
                    />
                    <LinhaMemoria
                      rotulo="(=) Resultado estimado por unidade"
                      valor={formatBRL(v.resultadoUnidade)}
                      formula="Preço final − custo líquido − tributos − despesas"
                    />
                    <LinhaMemoria
                      rotulo="Margem de contribuição"
                      valor={formatPercent(v.margemEfetiva)}
                      formula={
                        state.venda.baseMargem === "precoFinal"
                          ? "Resultado estimado ÷ preço final cobrado"
                          : "Resultado estimado ÷ preço antes dos tributos por fora"
                      }
                    />
                    <LinhaMemoria
                      rotulo="Markup"
                      valor={`${formatPercent(v.markupPercentual)} · ${v.markupMultiplicador.toFixed(2).replace(".", ",")}×`}
                      formula="Preço final ÷ custo líquido unitário"
                    />
                  </>
                ) : null}
              </tbody>
            </table>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
