import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp, FileText, FileSpreadsheet, Printer, Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { metaPagina } from "@/lib/seo-head";
import { formatBRL, formatNumero, formatPercent } from "@/lib/format";
import { useApp } from "@/hooks/useApp";
import { useAliquotas } from "@/hooks/useAliquotas";
import { aliquotaInterna } from "@/lib/aliquotas";
import { REGIMES } from "@/lib/pricing-engine";
import { parseNfeXml } from "@/lib/nfe/xml";
import { lerDanfePdf } from "@/lib/nfe/pdf";
import {
  precificarNota,
  premissasPadrao,
  type NotaPrecificada,
  type PremissasVenda,
} from "@/lib/nfe/para-simulacao";
import type { NotaImportada } from "@/lib/nfe/tipos";
import type { Regime } from "@/types/pricing";

const TITULO = "Importar nota fiscal — Precifica Grancont";
const DESCRICAO =
  "Importe XMLs de NF-e em lote ou o PDF do DANFE e gere a precificação da nota inteira, com custo líquido por item e preço de venda sugerido.";

const LIMITE_ARQUIVOS = 30;
const LIMITE_BYTES = 10 * 1024 * 1024;

export const Route = createFileRoute("/_authenticated/importar")({
  head: () => ({ ...metaPagina({ titulo: TITULO, descricao: DESCRICAO, caminho: "/importar" }) }),
  component: ImportarPage,
});

type Passo = 1 | 2 | 3;

function ImportarPage() {
  const { empresa } = useApp();
  const { tabela } = useAliquotas();
  const entradaRef = useRef<HTMLInputElement>(null);

  const [notas, setNotas] = useState<NotaImportada[]>([]);
  const [erros, setErros] = useState<string[]>([]);
  const [lendo, setLendo] = useState(false);
  const [passo, setPasso] = useState<Passo>(1);
  const [regime, setRegime] = useState<Regime>(
    (empresa?.regime as Regime | undefined) &&
      ["simples", "presumido", "real", "mei"].includes(empresa!.regime!)
      ? (empresa!.regime as Regime)
      : "real",
  );
  const [fronteiraAtiva, setFronteiraAtiva] = useState(false);
  const [premissas, setPremissas] = useState<PremissasVenda>(() => premissasPadrao());

  const ufEmpresa = empresa?.uf ?? "";
  const internaSugerida = aliquotaInterna(tabela, ufEmpresa);

  const calculadas: NotaPrecificada[] = useMemo(
    () =>
      notas.map((nota) =>
        precificarNota(nota, {
          regime,
          premissas,
          fronteiraAtiva,
          aliquotaInternaDestino: aliquotaInterna(tabela, nota.destinatario.uf || ufEmpresa),
        }),
      ),
    [notas, regime, premissas, fronteiraAtiva, tabela, ufEmpresa],
  );

  const totalGeral = useMemo(
    () =>
      calculadas.reduce(
        (acc, c) => ({
          desembolso: acc.desembolso + c.totais.desembolso,
          creditos: acc.creditos + c.totais.creditos,
          custoLiquido: acc.custoLiquido + c.totais.custoLiquido,
          receitaSugerida: acc.receitaSugerida + c.totais.receitaSugerida,
          resultadoSugerido: acc.resultadoSugerido + c.totais.resultadoSugerido,
        }),
        { desembolso: 0, creditos: 0, custoLiquido: 0, receitaSugerida: 0, resultadoSugerido: 0 },
      ),
    [calculadas],
  );

  async function receberArquivos(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    const arquivos = Array.from(lista);
    if (arquivos.length + notas.length > LIMITE_ARQUIVOS) {
      toast.error(`Envie no máximo ${LIMITE_ARQUIVOS} arquivos por vez.`);
      return;
    }

    setLendo(true);
    const novas: NotaImportada[] = [];
    const falhas: string[] = [];

    for (const arquivo of arquivos) {
      if (arquivo.size > LIMITE_BYTES) {
        falhas.push(`${arquivo.name}: arquivo maior que 10 MB.`);
        continue;
      }
      const nome = arquivo.name.toLowerCase();
      let leitura;
      if (nome.endsWith(".xml")) {
        leitura = parseNfeXml(await arquivo.text(), arquivo.name);
      } else if (nome.endsWith(".pdf")) {
        leitura = await lerDanfePdf(arquivo);
      } else {
        falhas.push(`${arquivo.name}: envie arquivos .xml (NF-e) ou .pdf (DANFE).`);
        continue;
      }

      if (leitura.erro || !leitura.nota) {
        falhas.push(leitura.erro ?? `${arquivo.name}: não foi possível ler a nota.`);
        continue;
      }
      const jaExiste = [...notas, ...novas].some(
        (n) => n.chave && leitura.nota!.chave && n.chave === leitura.nota!.chave,
      );
      if (jaExiste) {
        falhas.push(`${arquivo.name}: esta nota já foi importada neste lote.`);
        continue;
      }
      const nota = leitura.nota;
      if (
        empresa?.cnpj &&
        nota.destinatario.cnpj &&
        empresa.cnpj.replace(/\D/g, "") !== nota.destinatario.cnpj
      ) {
        nota.avisos.push(
          "O destinatário da nota é diferente do CNPJ da empresa selecionada. Confira se a nota é mesmo desta empresa.",
        );
      }
      novas.push(nota);
    }

    setNotas((atual) => [...atual, ...novas]);
    setErros(falhas);
    setLendo(false);
    if (novas.length > 0) {
      toast.success(`${novas.length} nota(s) lida(s).`);
      setPasso(2);
    } else if (falhas.length > 0) {
      toast.error("Nenhuma nota pôde ser lida.");
    }
    if (entradaRef.current) entradaRef.current.value = "";
  }

  const totalItens = notas.reduce((acc, n) => acc + n.itens.length, 0);

  function exportarCsv() {
    const linhas: string[] = [
      [
        "Nota",
        "Fornecedor",
        "Item",
        "Codigo",
        "Descricao",
        "NCM",
        "Quantidade",
        "Unidade",
        "Valor unitario",
        "Desembolso",
        "Creditos",
        "Custo liquido total",
        "Custo liquido unitario",
        "Preco sugerido",
        "Margem efetiva %",
      ].join(";"),
    ];
    for (const calc of calculadas) {
      for (const { item, resultado } of calc.itens) {
        linhas.push(
          [
            calc.nota.numero,
            calc.nota.emitente.nome,
            item.numero,
            item.codigo,
            item.descricao.replace(/;/g, ","),
            item.ncm,
            item.quantidade,
            item.unidade,
            item.valorUnitario,
            resultado.compra.desembolsoTotal,
            resultado.compra.creditosTotais,
            resultado.compra.custoLiquidoTotal,
            resultado.compra.custoLiquidoUnitario,
            resultado.recomendado?.precoFinal ?? "",
            resultado.recomendado?.margemEfetiva ?? "",
          ].join(";"),
        );
      }
    }
    const blob = new Blob(["\uFEFF" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "precificacao-notas.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main id="conteudo" className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Importar nota fiscal</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Envie os XMLs da NF-e (pode ser em lote) ou o PDF do DANFE. O sistema lê os itens e os
          tributos destacados, calcula o custo líquido de cada produto e sugere o preço de venda.
        </p>
      </header>

      <nav aria-label="Etapas da importação" className="mb-6 flex flex-wrap gap-2">
        {(
          [
            [1, "1. Enviar arquivos"],
            [2, "2. Revisar notas"],
            [3, "3. Precificação"],
          ] as const
        ).map(([n, rotulo]) => (
          <Button
            key={n}
            type="button"
            size="sm"
            variant={passo === n ? "default" : "outline"}
            disabled={n > 1 && notas.length === 0}
            onClick={() => setPasso(n as Passo)}
            aria-current={passo === n ? "step" : undefined}
          >
            {rotulo}
          </Button>
        ))}
      </nav>

      {passo === 1 && (
        <section aria-labelledby="envio-titulo" className="space-y-4">
          <h2 id="envio-titulo" className="sr-only">
            Envio de arquivos
          </h2>
          <div
            className="rounded-xl border border-dashed bg-card p-8 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void receberArquivos(e.dataTransfer.files);
            }}
          >
            <FileUp className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">Arraste os arquivos aqui ou escolha no aparelho</p>
            <p className="mt-1 text-xs text-muted-foreground">
              XML da NF-e (leitura exata) ou PDF do DANFE (leitura assistida). Até {LIMITE_ARQUIVOS}{" "}
              arquivos de 10 MB.
            </p>
            <input
              ref={entradaRef}
              type="file"
              accept=".xml,.pdf,text/xml,application/pdf"
              multiple
              className="sr-only"
              id="arquivos-nota"
              onChange={(e) => void receberArquivos(e.target.files)}
            />
            <Button asChild className="mt-4" disabled={lendo}>
              <label htmlFor="arquivos-nota" className="cursor-pointer">
                {lendo ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {lendo ? "Lendo arquivos…" : "Escolher arquivos"}
              </label>
            </Button>
          </div>

          {erros.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {erros.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {passo === 2 && (
        <section aria-labelledby="revisao-titulo" className="space-y-4">
          <h2 id="revisao-titulo" className="text-lg font-semibold">
            Notas lidas ({notas.length}) — {totalItens} itens
          </h2>
          {notas.map((nota) => (
            <article key={nota.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    Nota {nota.numero || "s/ número"}
                    {nota.serie ? ` · série ${nota.serie}` : ""} — {nota.emitente.nome || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {nota.emissao || "sem data"} · {nota.emitente.uf || "?"} →{" "}
                    {nota.destinatario.uf || "?"} · {nota.itens.length} itens ·{" "}
                    {formatBRL(nota.totais.nota)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={nota.confiavel ? "secondary" : "destructive"}>
                    {nota.confiavel ? "XML" : "PDF — conferir"}
                  </Badge>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remover a nota ${nota.numero || nota.arquivo}`}
                    onClick={() => setNotas((a) => a.filter((n) => n.id !== nota.id))}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              {nota.avisos.length > 0 && (
                <ul className="mt-3 space-y-1 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                  {nota.avisos.map((a) => (
                    <li key={a}>• {a}</li>
                  ))}
                </ul>
              )}

              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <caption className="sr-only">Itens da nota {nota.numero}</caption>
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-3">Item</th>
                      <th className="py-1 pr-3">Qtd.</th>
                      <th className="py-1 pr-3">Unitário</th>
                      <th className="py-1 pr-3">Frete</th>
                      <th className="py-1 pr-3">ICMS</th>
                      <th className="py-1 pr-3">ST</th>
                      <th className="py-1 pr-3">IPI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nota.itens.map((item) => (
                      <tr key={`${nota.id}-${item.numero}`} className="border-t">
                        <td className="py-1 pr-3">{item.descricao}</td>
                        <td className="py-1 pr-3">
                          {formatNumero(item.quantidade)} {item.unidade}
                        </td>
                        <td className="py-1 pr-3">{formatBRL(item.valorUnitario)}</td>
                        <td className="py-1 pr-3">{formatBRL(item.frete)}</td>
                        <td className="py-1 pr-3">{formatBRL(item.icms.valor)}</td>
                        <td className="py-1 pr-3">{formatBRL(item.icmsSt.valor)}</td>
                        <td className="py-1 pr-3">{formatBRL(item.ipi.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setPasso(1)}>
              Enviar mais arquivos
            </Button>
            <Button type="button" disabled={notas.length === 0} onClick={() => setPasso(3)}>
              Precificar notas
            </Button>
          </div>
        </section>
      )}

      {passo === 3 && (
        <section aria-labelledby="precificacao-titulo" className="space-y-6">
          <h2 id="precificacao-titulo" className="text-lg font-semibold">
            Precificação das notas
          </h2>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold">Premissas usadas em todos os itens</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              As alíquotas de venda são suas: nada é fixado pelo sistema.
              {internaSugerida !== null && ufEmpresa
                ? ` Alíquota interna cadastrada para ${ufEmpresa}: ${formatPercent(internaSugerida)}.`
                : ""}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="regime">Regime da empresa</Label>
                <Select value={regime} onValueChange={(v) => setRegime(v as Regime)}>
                  <SelectTrigger id="regime">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIMES.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(
                [
                  ["margemDesejada", "Margem desejada (%)"],
                  ["comissaoPercent", "Comissão (%)"],
                  ["cartaoPercent", "Cartão (%)"],
                  ["icmsVendaPercent", "ICMS na venda (%)"],
                  ["pisVendaPercent", "PIS na venda (%)"],
                  ["cofinsVendaPercent", "Cofins na venda (%)"],
                  ["dasPercent", "DAS do Simples (%)"],
                  ["freteVendaUnidade", "Frete por unidade (R$)"],
                  ["custoFixoUnidade", "Custo fixo por unidade (R$)"],
                ] as const
              ).map(([campo, rotulo]) => (
                <div key={campo} className="space-y-1.5">
                  <Label htmlFor={`campo-${campo}`}>{rotulo}</Label>
                  <Input
                    id={`campo-${campo}`}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={premissas[campo]}
                    onChange={(e) =>
                      setPremissas((p) => ({ ...p, [campo]: Number(e.target.value) || 0 }))
                    }
                  />
                </div>
              ))}
              <div className="flex items-end gap-2">
                <input
                  id="fronteira"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={fronteiraAtiva}
                  onChange={(e) => setFronteiraAtiva(e.target.checked)}
                />
                <Label htmlFor="fronteira" className="text-sm font-normal">
                  Considerar ICMS de fronteira (DIFAL/antecipação)
                </Label>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["Desembolso total", totalGeral.desembolso],
                ["Créditos recuperáveis", totalGeral.creditos],
                ["Custo líquido total", totalGeral.custoLiquido],
                ["Receita sugerida", totalGeral.receitaSugerida],
              ] as const
            ).map(([rotulo, valor]) => (
              <div key={rotulo} className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground">{rotulo}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{formatBRL(valor)}</p>
              </div>
            ))}
          </div>

          {calculadas.map((calc) => (
            <article key={calc.nota.id} className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-semibold">
                Nota {calc.nota.numero || calc.nota.arquivo} — {calc.nota.emitente.nome || "—"}
              </h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <caption className="sr-only">
                    Custo e preço sugerido dos itens da nota {calc.nota.numero}
                  </caption>
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-3">Produto</th>
                      <th className="py-1 pr-3">Qtd.</th>
                      <th className="py-1 pr-3">Desembolso</th>
                      <th className="py-1 pr-3">Créditos</th>
                      <th className="py-1 pr-3">Custo líq. unit.</th>
                      <th className="py-1 pr-3">Preço sugerido</th>
                      <th className="py-1 pr-3">Margem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calc.itens.map(({ item, resultado }) => (
                      <tr key={`${calc.nota.id}-${item.numero}`} className="border-t">
                        <td className="py-1 pr-3">{item.descricao}</td>
                        <td className="py-1 pr-3">
                          {formatNumero(item.quantidade)} {item.unidade}
                        </td>
                        <td className="py-1 pr-3 tabular-nums">
                          {formatBRL(resultado.compra.desembolsoTotal)}
                        </td>
                        <td className="py-1 pr-3 tabular-nums">
                          {formatBRL(resultado.compra.creditosTotais)}
                        </td>
                        <td className="py-1 pr-3 tabular-nums">
                          {formatBRL(resultado.compra.custoLiquidoUnitario)}
                        </td>
                        <td className="py-1 pr-3 font-medium tabular-nums">
                          {resultado.recomendado
                            ? formatBRL(resultado.recomendado.precoFinal)
                            : "não é possível"}
                        </td>
                        <td className="py-1 pr-3 tabular-nums">
                          {resultado.recomendado
                            ? formatPercent(resultado.recomendado.margemEfetiva)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-medium">
                      <td className="py-2 pr-3">Total da nota</td>
                      <td className="py-2 pr-3" />
                      <td className="py-2 pr-3 tabular-nums">
                        {formatBRL(calc.totais.desembolso)}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{formatBRL(calc.totais.creditos)}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {formatBRL(calc.totais.custoLiquido)}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {formatBRL(calc.totais.receitaSugerida)}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {formatBRL(calc.totais.resultadoSugerido)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </article>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={exportarCsv}>
              <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden="true" /> Exportar CSV
            </Button>
            <Button type="button" variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" aria-hidden="true" /> Imprimir / PDF
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPasso(2)}>
              Voltar à revisão
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}
