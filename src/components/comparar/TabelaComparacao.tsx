import { Badge } from "@/components/ui/badge";
import { formatBRL, formatPercent } from "@/lib/format";
import type { DestaqueId, SupplierComparison } from "@/types/comparison";

const ROTULO_DESTAQUE: Record<DestaqueId, string> = {
  menorDesembolso: "Menor desembolso",
  menorCustoLiquido: "Menor custo líquido",
  maiorCredito: "Maior crédito",
  melhorPrazo: "Melhor prazo",
  melhorOpcao: "Melhor opção econômica",
};

export function TabelaComparacao({ comparacao }: { comparacao: SupplierComparison }) {
  const { linhas } = comparacao;
  if (linhas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Informe pelo menos uma alternativa com quantidade maior que zero.
      </p>
    );
  }

  const ordenadas = [...linhas].sort((a, b) => a.custoLiquidoUnitario - b.custoLiquidoUnitario);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
      <table className="w-full min-w-[900px] text-sm">
        <caption className="sr-only">
          Comparação de alternativas de compra por custo líquido
        </caption>
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-4 py-3">
              Fornecedor
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Desembolso total
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Créditos
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Custo líquido total
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Custo líq. unitário
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Diferença R$/un
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Diferença %
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Economia no pedido
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Limite de frete
            </th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {ordenadas.map((l) => {
            const vencedor = l.destaques.includes("melhorOpcao");
            return (
              <tr
                key={l.id}
                className={`border-b border-border/60 last:border-0 ${vencedor ? "bg-primary/5" : ""}`}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{l.nome || "Sem nome"}</div>
                  <div className="text-xs text-muted-foreground">
                    {[l.uf, l.prazoDias ? `${l.prazoDias} dias` : null].filter(Boolean).join(" · ")}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {l.destaques.map((d) => (
                      <Badge
                        key={d}
                        variant={d === "melhorOpcao" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {ROTULO_DESTAQUE[d]}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">{formatBRL(l.desembolsoTotal)}</td>
                <td className="px-4 py-3 text-right">{formatBRL(l.creditosTotais)}</td>
                <td className="px-4 py-3 text-right">{formatBRL(l.custoLiquidoTotal)}</td>
                <td className="px-4 py-3 text-right font-semibold">
                  {formatBRL(l.custoLiquidoUnitario)}
                </td>
                <td
                  className={`px-4 py-3 text-right ${l.diferencaUnitaria < 0 ? "text-emerald-600" : l.diferencaUnitaria > 0 ? "text-destructive" : ""}`}
                >
                  {formatBRL(l.diferencaUnitaria)}
                </td>
                <td className="px-4 py-3 text-right">{formatPercent(l.diferencaPercentual)}</td>
                <td className="px-4 py-3 text-right">{formatBRL(l.economiaPedido)}</td>
                <td className="px-4 py-3 text-right">
                  {l.limiteFreteAdicional === null ? "—" : formatBRL(l.limiteFreteAdicional)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        Diferenças são medidas contra a melhor alternativa (a melhor é comparada com a segunda
        colocada). O ranking usa o custo líquido unitário — nunca o preço nominal.
      </p>
    </div>
  );
}
