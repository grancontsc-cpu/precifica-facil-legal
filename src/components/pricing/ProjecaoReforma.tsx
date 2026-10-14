import { useMemo, useState } from "react";
import { ChevronDown, TrendingDown, TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBRL, formatNumero, formatPercent } from "@/lib/format";
import {
  etapasDoEstado,
  etapasReformaPadrao,
  projetarReforma,
  type LinhaProjecao,
  type Variacao,
} from "@/lib/projecao-reforma";
import { cn } from "@/lib/utils";
import type { EtapaReforma, SaleEvaluation, SimulationState } from "@/types/pricing";

const sinal = (v: number | null, fmt: (n: number) => string) =>
  v === null ? "—" : `${v > 0 ? "+" : ""}${fmt(v)}`;
const pp = (v: number) => `${formatNumero(v, 2)} p.p.`;

function Celula({ children, destaque }: { children: React.ReactNode; destaque?: boolean }) {
  return (
    <td
      className={cn(
        "whitespace-nowrap px-3 py-2 text-right tabular-nums",
        destaque && "font-semibold",
      )}
    >
      {children}
    </td>
  );
}

function Cabecalho({ anos }: { anos: string[] }) {
  return (
    <thead>
      <tr className="border-b border-border text-xs text-muted-foreground">
        <th className="sticky left-0 bg-card px-3 py-2 text-left font-medium">Por unidade</th>
        {anos.map((a) => (
          <th key={a} className="px-3 py-2 text-right font-medium">
            {a}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function Linha({
  rotulo,
  valores,
  destaque,
}: {
  rotulo: string;
  valores: React.ReactNode[];
  destaque?: boolean;
}) {
  return (
    <tr className={cn("border-b border-border/60", destaque && "bg-muted/50")}>
      <th
        scope="row"
        className={cn(
          "sticky left-0 bg-card px-3 py-2 text-left text-sm font-normal",
          destaque && "bg-muted font-semibold",
        )}
      >
        {rotulo}
      </th>
      {valores.map((v, i) => (
        <Celula key={i} destaque={destaque}>
          {v}
        </Celula>
      ))}
    </tr>
  );
}

function Dre({ colunas }: { colunas: SaleEvaluation[] }) {
  return (
    <>
      <Linha
        rotulo="Preço cobrado do cliente"
        valores={colunas.map((c) => formatBRL(c.precoFinal))}
      />
      <Linha
        rotulo="Preço antes dos tributos por fora"
        valores={colunas.map((c) => formatBRL(c.precoBase))}
      />
      <Linha
        rotulo="(−) Tributos sobre a venda"
        valores={colunas.map((c) => formatBRL(c.tributosIncluidos + c.tributosPorFora))}
      />
      <Linha
        rotulo="Receita líquida"
        valores={colunas.map((c) =>
          formatBRL(c.precoFinal - c.tributosIncluidos - c.tributosPorFora),
        )}
      />
      <Linha
        rotulo="(−) Custo líquido da mercadoria"
        valores={colunas.map((c) => formatBRL(c.custoLiquidoUnitario))}
      />
      <Linha
        rotulo="(−) Despesas variáveis e fixas"
        valores={colunas.map((c) => formatBRL(c.despesasVariaveis + c.despesasFixasUnidade))}
      />
      <Linha
        rotulo="Lucro por unidade"
        destaque
        valores={colunas.map((c) => formatBRL(c.resultadoUnidade))}
      />
      <Linha
        rotulo="Margem"
        destaque
        valores={colunas.map((c) => formatPercent(c.margemEfetiva))}
      />
    </>
  );
}

function TabelaPreco({
  hoje,
  linhas,
  pegar,
}: {
  hoje: SaleEvaluation;
  linhas: LinhaProjecao[];
  pegar: (l: LinhaProjecao) => Variacao;
}) {
  const vs = linhas.map(pegar);
  const ok = vs.every((v) => v.preco);
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <Cabecalho anos={["Hoje", ...linhas.map((l) => l.ano)]} />
        <tbody>
          <Linha
            rotulo="Novo preço cobrado"
            destaque
            valores={[
              formatBRL(hoje.precoFinal),
              ...vs.map((v) => (v.preco ? formatBRL(v.preco.precoFinal) : "Inviável")),
            ]}
          />
          <Linha
            rotulo="Aumento (R$)"
            valores={["—", ...vs.map((v) => sinal(v.aumentoValor, formatBRL))]}
          />
          <Linha
            rotulo="Aumento (%)"
            valores={["—", ...vs.map((v) => sinal(v.aumentoPercent, formatPercent))]}
          />
          {ok ? <Dre colunas={[hoje, ...vs.map((v) => v.preco!)]} /> : null}
        </tbody>
      </table>
    </div>
  );
}

function EditorEtapas({
  etapas,
  onChange,
}: {
  etapas: EtapaReforma[];
  onChange: (e: EtapaReforma[]) => void;
}) {
  const set = (i: number, campo: "cbs" | "ibs" | "fatorIcms", v: string) => {
    const n = Number(v.replace(",", "."));
    if (!Number.isFinite(n)) return;
    onChange(etapas.map((e, j) => (j === i ? { ...e, [campo]: n } : e)));
  };
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="px-2 py-1 text-left">Ano</th>
              <th className="px-2 py-1 text-left">CBS (%)</th>
              <th className="px-2 py-1 text-left">IBS (%)</th>
              <th className="px-2 py-1 text-left">ICMS vigente (% da alíquota)</th>
            </tr>
          </thead>
          <tbody>
            {etapas.map((e, i) => (
              <tr key={e.ano}>
                <td className="px-2 py-1 font-medium">{e.ano}</td>
                {(["cbs", "ibs", "fatorIcms"] as const).map((c) => (
                  <td key={c} className="px-2 py-1">
                    <Input
                      inputMode="decimal"
                      aria-label={`${c === "fatorIcms" ? "ICMS vigente" : c.toUpperCase()} em ${e.ano}`}
                      className="h-8 w-24"
                      defaultValue={String(e[c]).replace(".", ",")}
                      onBlur={(ev) => set(i, c, ev.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="outline" size="sm" onClick={() => onChange(etapasReformaPadrao())}>
        Voltar às alíquotas de referência
      </Button>
    </div>
  );
}

export function ProjecaoReforma({
  state,
  onEtapas,
}: {
  state: SimulationState;
  onEtapas: (e: EtapaReforma[]) => void;
}) {
  const [editar, setEditar] = useState(false);
  const projecao = useMemo(() => projetarReforma(state), [state]);
  const etapas = etapasDoEstado(state);

  if (!projecao) {
    return (
      <p className="text-sm text-muted-foreground">
        Complete a simulação (produto, custo e preço) para ver o impacto da Reforma Tributária ano a
        ano.
      </p>
    );
  }
  const { hoje, linhas, piorAno } = projecao;
  const anos = ["Hoje", ...linhas.map((l) => l.ano)];
  const l27 = linhas.find((l) => l.ano === "2027");
  const l33 = linhas.find((l) => l.ano === "2033");
  const pior = linhas.find((l) => l.ano === piorAno);
  const maxLucro = Math.max(
    Math.abs(hoje.resultadoUnidade),
    ...linhas.map((l) => Math.abs(l.mantendoPreco.resultadoUnidade)),
    0.01,
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[l27, l33].map((l) =>
          l ? (
            <div key={l.ano} className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">
                Aumento para manter o lucro em {l.ano}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xl font-semibold">
                <TrendingUp className="size-4 text-primary" aria-hidden />
                {sinal(l.mantendoLucro.aumentoPercent, formatPercent)}
              </p>
              <p className="text-xs text-muted-foreground">
                Sem reajuste, o lucro muda {sinal(l.perdaLucro, formatBRL)} por unidade
              </p>
            </div>
          ) : null,
        )}
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-xs text-muted-foreground">Ano de maior impacto</p>
          <p className="mt-1 flex items-center gap-1 text-xl font-semibold">
            <TrendingDown className="size-4 text-destructive" aria-hidden />
            {pior ? pior.ano : "Sem perda"}
          </p>
          <p className="text-xs text-muted-foreground">
            {pior
              ? `Perde ${formatBRL(-pior.perdaLucro)} por unidade (${pp(pior.perdaMargemPp)}) mantendo o preço`
              : "O lucro não cai em nenhuma etapa mantendo o preço."}
          </p>
        </div>
      </div>

      <div aria-hidden className="rounded-lg border border-border p-3">
        <p className="mb-2 text-xs text-muted-foreground">
          Lucro por unidade mantendo o preço de hoje
        </p>
        <div className="flex h-28 items-end gap-2">
          {[hoje.resultadoUnidade, ...linhas.map((l) => l.mantendoPreco.resultadoUnidade)].map(
            (v, i) => (
              <div key={anos[i]} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={cn("w-full rounded-t", v >= 0 ? "bg-primary/70" : "bg-destructive/70")}
                  style={{ height: `${(Math.abs(v) / maxLucro) * 80}px` }}
                />
                <span className="text-[10px] text-muted-foreground">{anos[i]}</span>
              </div>
            ),
          )}
        </div>
      </div>

      <Tabs defaultValue="preco">
        <TabsList className="flex h-auto w-full flex-wrap">
          <TabsTrigger value="preco" className="flex-1">
            Mantendo o preço
          </TabsTrigger>
          <TabsTrigger value="lucro" className="flex-1">
            Manter lucro (R$)
          </TabsTrigger>
          <TabsTrigger value="margem" className="flex-1">
            Manter margem (%)
          </TabsTrigger>
        </TabsList>
        <TabsContent value="preco" className="mt-3">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <Cabecalho anos={anos} />
              <tbody>
                <Dre colunas={[hoje, ...linhas.map((l) => l.mantendoPreco)]} />
                <Linha
                  rotulo="Perda de lucro (R$)"
                  valores={["—", ...linhas.map((l) => sinal(l.perdaLucro, formatBRL))]}
                />
                <Linha
                  rotulo="Perda de margem"
                  valores={["—", ...linhas.map((l) => sinal(l.perdaMargemPp, pp))]}
                />
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="lucro" className="mt-3">
          <TabelaPreco hoje={hoje} linhas={linhas} pegar={(l) => l.mantendoLucro} />
        </TabsContent>
        <TabsContent value="margem" className="mt-3">
          <TabelaPreco hoje={hoje} linhas={linhas} pegar={(l) => l.mantendoMargem} />
        </TabsContent>
      </Tabs>

      <div className="rounded-lg border border-border">
        <button
          type="button"
          aria-expanded={editar}
          onClick={() => setEditar((v) => !v)}
          className="flex w-full items-center justify-between p-3 text-left text-sm font-medium"
        >
          Alíquotas usadas em cada ano (editáveis)
          <ChevronDown
            className={cn("size-4 transition-transform", editar && "rotate-180")}
            aria-hidden
          />
        </button>
        {editar ? (
          <div className="border-t border-border p-3">
            <EditorEtapas key={JSON.stringify(etapas)} etapas={etapas} onChange={onEtapas} />
          </div>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Projeção gerencial com base na EC 132/2023 e LC 214/2025. Considera o mesmo custo de compra,
        despesas e regime de hoje; no Simples, a alíquota do DAS é mantida. Alíquotas de IBS/CBS são
        de referência e devem ser confirmadas com a contabilidade.
      </p>
    </div>
  );
}
