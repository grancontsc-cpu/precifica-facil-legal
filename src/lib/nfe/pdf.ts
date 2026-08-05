import { parteVazia, totaisVazios, tributoVazio, type ItemNota, type LeituraNota } from "./tipos";
import { conferir, ratearCabecalho } from "./xml";

/**
 * Leitura assistida do DANFE em PDF.
 *
 * O PDF não é um documento estruturado: aqui o texto é extraído e os itens são
 * reconhecidos por heurística. O resultado entra sempre marcado como "conferir"
 * e o usuário revisa os campos antes de precificar.
 */

/** Extrai o texto de todas as páginas do PDF (somente no navegador). */
export async function textoDoPdf(arquivo: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const buffer = await arquivo.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const linhas: string[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const pagina = await doc.getPage(p);
    const conteudo = await pagina.getTextContent();
    const porLinha = new Map<number, string[]>();
    for (const item of conteudo.items) {
      if (!("str" in item)) continue;
      const y = Math.round((item.transform?.[5] ?? 0) / 3);
      const atual = porLinha.get(y) ?? [];
      atual.push(item.str);
      porLinha.set(y, atual);
    }
    const ordenadas = Array.from(porLinha.entries()).sort((a, b) => b[0] - a[0]);
    for (const [, partes] of ordenadas) {
      const linha = partes.join(" ").replace(/\s+/g, " ").trim();
      if (linha) linhas.push(linha);
    }
  }
  return linhas;
}

const NUM = "[\\d.]+,\\d{2,4}";

function paraNumero(v: string): number {
  const limpo = (v ?? "").replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Reconhece linhas de item do DANFE no padrão:
 * código, descrição, NCM, CST, CFOP, unidade, quantidade, valor unitário, valor total…
 */
export function itensDoTexto(linhas: string[]): ItemNota[] {
  const itens: ItemNota[] = [];
  const padrao = new RegExp(
    `^(\\S+)\\s+(.+?)\\s+(\\d{8})\\s+(\\d{2,3})?\\s*(\\d{4})\\s+([A-Za-z]{1,6})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})(.*)$`,
  );

  for (const linha of linhas) {
    const m = padrao.exec(linha);
    if (!m) continue;
    const quantidade = paraNumero(m[7]);
    const unitario = paraNumero(m[8]);
    const total = paraNumero(m[9]);
    if (quantidade <= 0 || total <= 0) continue;

    const resto = (m[10] ?? "").match(new RegExp(NUM, "g")) ?? [];
    const valores = resto.map(paraNumero);

    itens.push({
      numero: itens.length + 1,
      codigo: m[1],
      descricao: m[2].trim(),
      ncm: m[3],
      cfop: m[5],
      unidade: m[6],
      quantidade,
      valorUnitario: unitario,
      valorProduto: total,
      desconto: 0,
      frete: 0,
      seguro: 0,
      outras: 0,
      origem: (m[4] ?? "").slice(0, 1),
      icms: { ...tributoVazio(), cst: m[4] ?? "", valor: valores[2] ?? 0 },
      icmsSt: tributoVazio(),
      fcp: 0,
      ipi: { ...tributoVazio(), valor: valores[3] ?? 0 },
      pis: tributoVazio(),
      cofins: tributoVazio(),
    });
  }

  return itens;
}

function acharValor(linhas: string[], rotulo: RegExp): number {
  for (const linha of linhas) {
    if (!rotulo.test(linha)) continue;
    const encontrados = linha.match(new RegExp(NUM, "g"));
    if (encontrados?.length) return paraNumero(encontrados[encontrados.length - 1]);
  }
  return 0;
}

function acharTexto(linhas: string[], rotulo: RegExp): string {
  for (const linha of linhas) {
    const m = rotulo.exec(linha);
    if (m?.[1]) return m[1].trim();
  }
  return "";
}

/** Monta a nota a partir do texto extraído do DANFE. */
export function notaDoTextoPdf(linhas: string[], arquivo: string): LeituraNota {
  const itens = itensDoTexto(linhas);
  if (itens.length === 0) {
    return {
      nota: null,
      erro: `${arquivo}: não foi possível reconhecer os itens do DANFE. Use o XML da nota para um cálculo exato.`,
    };
  }

  const chave = (linhas.join(" ").match(/\b(\d{44})\b/) ?? [])[1] ?? "";
  const chaveEspacada = (linhas.join(" ").match(/((?:\d{4}\s){10}\d{4})/) ?? [])[1] ?? "";

  const totais = {
    ...totaisVazios(),
    produtos: acharValor(linhas, /VALOR\s+TOTAL\s+DOS\s+PRODUTOS/i),
    desconto: acharValor(linhas, /DESCONTO/i),
    frete: acharValor(linhas, /VALOR\s+DO\s+FRETE/i),
    seguro: acharValor(linhas, /VALOR\s+DO\s+SEGURO/i),
    outras: acharValor(linhas, /OUTRAS\s+DESPESAS/i),
    icms: acharValor(linhas, /VALOR\s+DO\s+ICMS(?!\s+SUBST)/i),
    icmsSt: acharValor(linhas, /ICMS\s+SUBSTITUI/i),
    ipi: acharValor(linhas, /VALOR\s+DO\s+IPI/i),
    nota: acharValor(linhas, /VALOR\s+TOTAL\s+DA\s+NOTA/i),
  };

  const somaItens = itens.reduce((acc, i) => acc + i.valorProduto, 0);
  if (totais.produtos <= 0) totais.produtos = Number(somaItens.toFixed(2));
  if (totais.nota <= 0) totais.nota = totais.produtos + totais.frete + totais.icmsSt + totais.ipi;

  const nota = {
    id: `${arquivo}-${itens.length}`,
    arquivo,
    formato: "pdf" as const,
    confiavel: false,
    chave: chave || chaveEspacada.replace(/\s/g, ""),
    numero: acharTexto(linhas, /N[ºo°]\.?\s*(\d{3}\.?\d{3}\.?\d{3})/i).replace(/\./g, ""),
    serie: acharTexto(linhas, /S[ÉE]RIE\s*:?\s*(\d{1,3})/i),
    emissao: acharTexto(linhas, /(\d{2}\/\d{2}\/\d{4})/),
    emitente: { ...parteVazia(), nome: linhas[0] ?? "" },
    destinatario: parteVazia(),
    totais,
    itens: ratearCabecalho(itens, totais),
    avisos: [
      "Leitura assistida do PDF: confira descrição, quantidade, valores e tributos antes de precificar. O XML da nota traz os dados exatos.",
    ],
  };

  conferir(nota);
  return { nota, erro: null };
}

/** Lê um arquivo PDF de DANFE e devolve a nota para revisão. */
export async function lerDanfePdf(arquivo: File): Promise<LeituraNota> {
  try {
    const linhas = await textoDoPdf(arquivo);
    if (linhas.length === 0) {
      return {
        nota: null,
        erro: `${arquivo.name}: o PDF não tem texto (provavelmente é uma imagem digitalizada). Use o XML da nota.`,
      };
    }
    return notaDoTextoPdf(linhas, arquivo.name);
  } catch {
    return { nota: null, erro: `${arquivo.name}: não foi possível ler o PDF.` };
  }
}
