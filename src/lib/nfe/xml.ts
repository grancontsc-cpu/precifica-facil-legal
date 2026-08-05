import {
  parteVazia,
  totaisVazios,
  tributoVazio,
  type ItemNota,
  type LeituraNota,
  type NotaImportada,
  type TributoItem,
} from "./tipos";
import { distribuirProporcional } from "./rateio";

/* ------------------------------------------------------------------ */
/* Utilidades de leitura                                               */
/* ------------------------------------------------------------------ */

function filhos(el: Element | null, nome: string): Element[] {
  if (!el) return [];
  return Array.from(el.children).filter((c) => nomeLocal(c) === nome);
}

function nomeLocal(el: Element): string {
  return el.localName || el.nodeName.replace(/^.*:/, "");
}

/** Primeiro descendente com o nome informado, ignorando o namespace. */
function achar(raiz: Element | Document | null, nome: string): Element | null {
  if (!raiz) return null;
  const fila: Element[] = [];
  const inicio = raiz instanceof Document ? raiz.documentElement : raiz;
  if (!inicio) return null;
  if (!(raiz instanceof Document) && nomeLocal(inicio) === nome) return inicio;
  fila.push(inicio);
  while (fila.length) {
    const atual = fila.shift()!;
    for (const filho of Array.from(atual.children)) {
      if (nomeLocal(filho) === nome) return filho;
      fila.push(filho);
    }
  }
  return null;
}

function texto(raiz: Element | null, nome: string): string {
  const el = achar(raiz, nome);
  return el?.textContent?.trim() ?? "";
}

function numero(raiz: Element | null, nome: string): number {
  const bruto = texto(raiz, nome);
  if (!bruto) return 0;
  const v = Number(bruto.replace(",", "."));
  return Number.isFinite(v) ? v : 0;
}

function apenasDigitos(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

/* ------------------------------------------------------------------ */
/* Tributos do item                                                    */
/* ------------------------------------------------------------------ */

/** O grupo ICMS da NF-e vem em subgrupos (ICMS00, ICMS60, ICMSSN102…). */
function grupoIcms(imposto: Element | null): Element | null {
  const icms = achar(imposto, "ICMS");
  if (!icms) return null;
  const sub = Array.from(icms.children).find((c) => nomeLocal(c).startsWith("ICMS"));
  return sub ?? icms;
}

function lerIcms(imposto: Element | null): { proprio: TributoItem; st: TributoItem; fcp: number } {
  const g = grupoIcms(imposto);
  if (!g) return { proprio: tributoVazio(), st: tributoVazio(), fcp: 0 };

  const cst = texto(g, "CST") || texto(g, "CSOSN");
  const proprio: TributoItem = {
    cst,
    base: numero(g, "vBC"),
    aliquota: numero(g, "pICMS"),
    valor: numero(g, "vICMS"),
  };
  const st: TributoItem = {
    cst,
    base: numero(g, "vBCST"),
    aliquota: numero(g, "pICMSST"),
    valor: numero(g, "vICMSST") + numero(g, "vFCPST"),
  };
  return { proprio, st, fcp: numero(g, "vFCP") };
}

function lerContribuicao(imposto: Element | null, nome: "PIS" | "COFINS"): TributoItem {
  const grupo = achar(imposto, nome);
  if (!grupo) return tributoVazio();
  const sub = Array.from(grupo.children).find((c) => nomeLocal(c).startsWith(nome)) ?? grupo;
  return {
    cst: texto(sub, "CST"),
    base: numero(sub, "vBC"),
    aliquota: numero(sub, nome === "PIS" ? "pPIS" : "pCOFINS"),
    valor: numero(sub, nome === "PIS" ? "vPIS" : "vCOFINS"),
  };
}

function lerIpi(imposto: Element | null): TributoItem {
  const ipi = achar(imposto, "IPI");
  if (!ipi) return tributoVazio();
  const trib = achar(ipi, "IPITrib") ?? achar(ipi, "IPINT") ?? ipi;
  return {
    cst: texto(trib, "CST"),
    base: numero(trib, "vBC"),
    aliquota: numero(trib, "pIPI"),
    valor: numero(trib, "vIPI"),
  };
}

/* ------------------------------------------------------------------ */
/* Leitura da nota                                                     */
/* ------------------------------------------------------------------ */

export function parseNfeXml(conteudo: string, arquivo: string): LeituraNota {
  if (typeof DOMParser === "undefined") {
    return { nota: null, erro: "Leitura de XML disponível apenas no navegador." };
  }

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(conteudo, "application/xml");
  } catch {
    return { nota: null, erro: `${arquivo}: arquivo XML inválido.` };
  }
  if (achar(doc, "parsererror")) {
    return { nota: null, erro: `${arquivo}: arquivo XML inválido ou corrompido.` };
  }

  const infNFe = achar(doc, "infNFe");
  if (!infNFe) {
    return {
      nota: null,
      erro: `${arquivo}: não é um XML de NF-e (nenhuma nota encontrada no arquivo).`,
    };
  }

  const avisos: string[] = [];

  const situacao = texto(doc.documentElement, "cStat");
  if (["101", "135", "151", "155"].includes(situacao)) {
    return { nota: null, erro: `${arquivo}: nota cancelada — não pode ser precificada.` };
  }
  if (["110", "301", "302", "303"].includes(situacao)) {
    return { nota: null, erro: `${arquivo}: nota denegada — não pode ser precificada.` };
  }

  const ide = achar(infNFe, "ide");
  const emit = achar(infNFe, "emit");
  const dest = achar(infNFe, "dest");
  const icmsTot = achar(infNFe, "ICMSTot");

  const chave = apenasDigitos(infNFe.getAttribute("Id") ?? "");
  const emissao = (texto(ide, "dhEmi") || texto(ide, "dEmi")).slice(0, 10);

  const detalhes = filhos(infNFe, "det");
  if (detalhes.length === 0) {
    return { nota: null, erro: `${arquivo}: a nota não possui itens.` };
  }

  const itens: ItemNota[] = detalhes.map((det, i) => {
    const prod = achar(det, "prod");
    const imposto = achar(det, "imposto");
    const { proprio, st, fcp } = lerIcms(imposto);
    const quantidade = numero(prod, "qCom");
    const valorProduto = numero(prod, "vProd");
    const unitario = numero(prod, "vUnCom");

    return {
      numero: Number(det.getAttribute("nItem") ?? i + 1) || i + 1,
      codigo: texto(prod, "cProd"),
      descricao: texto(prod, "xProd"),
      ncm: texto(prod, "NCM"),
      cfop: texto(prod, "CFOP"),
      unidade: texto(prod, "uCom") || "unidade",
      quantidade,
      valorUnitario: unitario || (quantidade > 0 ? valorProduto / quantidade : 0),
      valorProduto,
      desconto: numero(prod, "vDesc"),
      frete: numero(prod, "vFrete"),
      seguro: numero(prod, "vSeg"),
      outras: numero(prod, "vOutro"),
      origem: texto(grupoIcms(imposto), "orig"),
      icms: proprio,
      icmsSt: st,
      fcp,
      ipi: lerIpi(imposto),
      pis: lerContribuicao(imposto, "PIS"),
      cofins: lerContribuicao(imposto, "COFINS"),
    };
  });

  const totais = {
    ...totaisVazios(),
    produtos: numero(icmsTot, "vProd"),
    desconto: numero(icmsTot, "vDesc"),
    frete: numero(icmsTot, "vFrete"),
    seguro: numero(icmsTot, "vSeg"),
    outras: numero(icmsTot, "vOutro"),
    icms: numero(icmsTot, "vICMS"),
    icmsSt: numero(icmsTot, "vST") + numero(icmsTot, "vFCPST"),
    ipi: numero(icmsTot, "vIPI"),
    pis: numero(icmsTot, "vPIS"),
    cofins: numero(icmsTot, "vCOFINS"),
    nota: numero(icmsTot, "vNF"),
  };

  const nota: NotaImportada = {
    id: `${chave || arquivo}-${itens.length}`,
    arquivo,
    formato: "xml",
    confiavel: true,
    chave,
    numero: texto(ide, "nNF"),
    serie: texto(ide, "serie"),
    emissao,
    emitente: {
      ...parteVazia(),
      nome: texto(emit, "xNome"),
      cnpj: apenasDigitos(texto(emit, "CNPJ") || texto(emit, "CPF")),
      uf: texto(achar(emit, "enderEmit"), "UF"),
    },
    destinatario: {
      ...parteVazia(),
      nome: texto(dest, "xNome"),
      cnpj: apenasDigitos(texto(dest, "CNPJ") || texto(dest, "CPF")),
      uf: texto(achar(dest, "enderDest"), "UF"),
    },
    totais,
    itens: ratearCabecalho(itens, totais),
    avisos,
  };

  conferir(nota);
  return { nota, erro: null };
}

/**
 * Frete, seguro, desconto e outras despesas informados só no total da nota
 * são rateados por item, na proporção do valor do produto. Quando o item já
 * traz o valor, ele prevalece.
 */
export function ratearCabecalho(itens: ItemNota[], totais: {
  frete: number;
  seguro: number;
  outras: number;
  desconto: number;
}): ItemNota[] {
  const pesos = itens.map((i) => i.valorProduto);
  const campos = ["frete", "seguro", "outras", "desconto"] as const;
  const rateios: Record<(typeof campos)[number], number[]> = {
    frete: [],
    seguro: [],
    outras: [],
    desconto: [],
  };

  for (const campo of campos) {
    const somaItens = itens.reduce((acc, i) => acc + (i[campo] || 0), 0);
    const totalNota = totais[campo] || 0;
    const faltante = Math.max(0, Number((totalNota - somaItens).toFixed(2)));
    rateios[campo] = faltante > 0 ? distribuirProporcional(pesos, faltante) : itens.map(() => 0);
  }

  return itens.map((item, i) => ({
    ...item,
    frete: Number(((item.frete || 0) + rateios.frete[i]).toFixed(2)),
    seguro: Number(((item.seguro || 0) + rateios.seguro[i]).toFixed(2)),
    outras: Number(((item.outras || 0) + rateios.outras[i]).toFixed(2)),
    desconto: Number(((item.desconto || 0) + rateios.desconto[i]).toFixed(2)),
  }));
}

/** Validações de consistência que viram avisos na tela de revisão. */
export function conferir(nota: NotaImportada): NotaImportada {
  const somaItens = nota.itens.reduce((acc, i) => acc + i.valorProduto, 0);
  if (nota.totais.produtos > 0 && Math.abs(somaItens - nota.totais.produtos) > 0.05) {
    nota.avisos.push(
      `A soma dos itens (${somaItens.toFixed(2)}) é diferente do total de produtos da nota (${nota.totais.produtos.toFixed(2)}). Confira antes de precificar.`,
    );
  }
  for (const item of nota.itens) {
    if (item.quantidade <= 0) {
      nota.avisos.push(`Item ${item.numero} (${item.descricao}) está sem quantidade.`);
    }
    if (item.valorProduto <= 0) {
      nota.avisos.push(`Item ${item.numero} (${item.descricao}) está sem valor.`);
    }
  }
  if (nota.emitente.uf && nota.destinatario.uf && nota.emitente.uf !== nota.destinatario.uf) {
    nota.avisos.push(
      "Compra interestadual: verifique se há ICMS de fronteira (DIFAL ou antecipação), que não vem destacado na nota.",
    );
  }
  return nota;
}
