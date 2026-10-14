import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { enviarDoRapido } from "@/lib/progresso-simulacao";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  FileUp,
  FileText,
  FileSpreadsheet,
  Printer,
  Trash2,
  Loader2,
  History as HistoryIcon,
  RotateCcw,
} from "lucide-react";

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
import { notaDaFoto } from "@/lib/nfe/foto";
import { lerFotoNota } from "@/lib/nfe/foto.functions";

/** Reduz a foto (máx. 2000 px, JPEG) antes de enviar para leitura. */
async function imagemParaEnvio(arquivo: File): Promise<string> {
  const original = await new Promise<string>((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = erro;
    r.readAsDataURL(arquivo);
  });
  try {
    const img = new Image();
    await new Promise((ok, erro) => {
      img.onload = ok;
      img.onerror = erro;
      img.src = original;
    });
    const escala = Math.min(1, 2000 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.88);
  } catch {
    return original;
  }
}
import {
  precificarNota,
  premissasPadrao,
  type NotaPrecificada,
  type PremissasVenda,
} from "@/lib/nfe/para-simulacao";
import {
  chaveItem,
  compararItem,
  criarVersao,
  diferencasPremissas,
  type VersaoLote,
} from "@/lib/nfe/versoes";
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
  const navegar = useNavigate();
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
  const [versoes, setVersoes] = useState<VersaoLote[]>([]);
  const [versaoBaseId, setVersaoBaseId] = useState<string>("");

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

  const versaoBase = useMemo(
    () => versoes.find((v) => v.id === versaoBaseId) ?? null,
    [versoes, versaoBaseId],
  );

  const mudancasPremissas = useMemo(
    () => (versaoBase ? diferencasPremissas(versaoBase, premissas, regime, fronteiraAtiva) : []),
    [versaoBase, premissas, regime, fronteiraAtiva],
  );

  function salvarVersao() {
    if (calculadas.length === 0) return;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now());
    const versao = criarVersao(calculadas, {
      id,
      rotulo: `Versão ${versoes.length + 1}`,
      criadaEm: new Date().toISOString(),
      regime,
      fronteiraAtiva,
      premissas,
    });
    setVersoes((v) => [...v, versao]);
    setVersaoBaseId(id);
    toast.success(`${versao.rotulo} salva. Altere as premissas para reprocessar e comparar.`);
  }

  function restaurarVersao(v: VersaoLote) {
    setRegime(v.regime);
    setFronteiraAtiva(v.fronteiraAtiva);
    setPremissas({ ...v.premissas });
    toast.success(`Premissas da ${v.rotulo} restauradas.`);
  }

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
      } else if (arquivo.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/.test(nome)) {
        try {
          const imagem = await imagemParaEnvio(arquivo);
          const r = await lerFotoNota({ data: { imagem } });
          leitura = r.dados
            ? notaDaFoto(r.dados, arquivo.name)
            : { nota: null, erro: `${arquivo.name}: ${r.erro}` };
        } catch {
          leitura = {
            nota: null,
            erro: `${arquivo.name}: não foi possível enviar a foto. Tente novamente.`,
          };
        }
      } else {
        falhas.push(`${arquivo.name}: envie .xml (NF-e), .pdf (DANFE) ou foto da nota.`);
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

          <div className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Reprocessar o lote e comparar</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Salve a precificação atual como versão, mude as premissas e veja lado a lado o
                  preço sugerido anterior e o recalculado.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" onClick={salvarVersao}>
                  <HistoryIcon className="mr-2 h-4 w-4" aria-hidden="true" /> Salvar versão atual
                </Button>
                {versoes.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="versao-base" className="text-xs font-normal">
                      Comparar com
                    </Label>
                    <Select value={versaoBaseId} onValueChange={setVersaoBaseId}>
                      <SelectTrigger id="versao-base" className="w-[190px]">
                        <SelectValue placeholder="Nenhuma versão" />
                      </SelectTrigger>
                      <SelectContent>
                        {versoes.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.rotulo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {versaoBase && (
              <div className="mt-4 space-y-3 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="secondary">
                    {versaoBase.rotulo} ·{" "}
                    {new Date(versaoBase.criadaEm).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </Badge>
                  <span className="text-muted-foreground">
                    Receita da versão: {formatBRL(versaoBase.totais.receitaSugerida)} · agora:{" "}
                    {formatBRL(totalGeral.receitaSugerida)}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => restaurarVersao(versaoBase)}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" /> Restaurar premissas
                  </Button>
                </div>
                {mudancasPremissas.length === 0 ? (
                  <p className="text-muted-foreground">
                    As premissas atuais são iguais às da versão comparada.
                  </p>
                ) : (
                  <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                    {mudancasPremissas.map((d) => (
                      <li key={d.campo} className="rounded-md bg-muted/60 px-2 py-1">
                        <span className="font-medium">{d.campo}</span>: {String(d.anterior)} →{" "}
                        {String(d.atual)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
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
                      {versaoBase && <th className="py-1 pr-3">Preço anterior</th>}
                      <th className="py-1 pr-3">Preço sugerido</th>
                      {versaoBase && <th className="py-1 pr-3">Variação</th>}
                      <th className="py-1 pr-3">Margem</th>
                      <th className="py-1 pr-3"><span className="sr-only">Ações</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {calc.itens.map(({ item, resultado, estado }) => {
                      const comp = compararItem(
                        versaoBase,
                        chaveItem(calc.nota.id, item.numero),
                        resultado.recomendado?.precoFinal ?? null,
                        resultado.recomendado?.margemEfetiva ?? null,
                      );
                      return (
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
                          {versaoBase && (
                            <td className="py-1 pr-3 tabular-nums text-muted-foreground">
                              {comp.precoAnterior !== null ? formatBRL(comp.precoAnterior) : "—"}
                            </td>
                          )}
                          <td className="py-1 pr-3 font-medium tabular-nums">
                            {resultado.recomendado
                              ? formatBRL(resultado.recomendado.precoFinal)
                              : "não é possível"}
                          </td>
                          {versaoBase && (
                            <td className="py-1 pr-3 tabular-nums">
                              {comp.variacaoAbsoluta === null ? (
                                "—"
                              ) : (
                                <span
                                  className={
                                    comp.variacaoAbsoluta > 0
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : comp.variacaoAbsoluta < 0
                                        ? "text-destructive"
                                        : "text-muted-foreground"
                                  }
                                >
                                  {comp.variacaoAbsoluta > 0 ? "+" : ""}
                                  {formatBRL(comp.variacaoAbsoluta)}
                                  {comp.variacaoPercentual !== null
                                    ? ` (${comp.variacaoPercentual > 0 ? "+" : ""}${formatPercent(comp.variacaoPercentual)})`
                                    : ""}
                                </span>
                              )}
                            </td>
                          )}
                          <td className="py-1 pr-3 tabular-nums">
                            {resultado.recomendado
                              ? formatPercent(resultado.recomendado.margemEfetiva)
                              : "—"}
                          </td>
                          <td className="py-1 pr-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                enviarDoRapido(estado);
                                void navegar({ to: "/simulador" });
                              }}
                            >
                              Abrir no simulador
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
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
                      {versaoBase && <td className="py-2 pr-3" />}
                      <td className="py-2 pr-3 tabular-nums">
                        {formatBRL(calc.totais.receitaSugerida)}
                      </td>
                      {versaoBase && <td className="py-2 pr-3" />}
                      <td className="py-2 pr-3 tabular-nums">
                        {formatBRL(calc.totais.resultadoSugerido)}
                      </td>
                      <td className="py-2 pr-3" />
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
