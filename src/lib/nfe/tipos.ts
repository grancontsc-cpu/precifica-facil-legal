/**
 * Modelo de uma nota fiscal importada (XML da NF-e ou leitura assistida do DANFE em PDF).
 *
 * Os valores são sempre os destacados no documento — o motor de precificação
 * decide o que é desembolso, o que é crédito e o que é custo líquido.
 */

export interface TributoItem {
  /** CST/CSOSN destacado no documento (string, pode vir vazio no PDF). */
  cst: string;
  base: number;
  aliquota: number;
  valor: number;
}

export interface ItemNota {
  /** Número sequencial do item na nota. */
  numero: number;
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorProduto: number;
  desconto: number;
  frete: number;
  seguro: number;
  outras: number;
  /** Código de origem da mercadoria (0 a 8); 1, 2, 6 e 7 indicam importada. */
  origem: string;
  icms: TributoItem;
  /** ICMS retido por substituição tributária (inclui o FCP-ST quando houver). */
  icmsSt: TributoItem;
  /** Fundo de Combate à Pobreza destacado na operação própria. */
  fcp: number;
  ipi: TributoItem;
  pis: TributoItem;
  cofins: TributoItem;
}

export interface ParteNota {
  nome: string;
  cnpj: string;
  uf: string;
}

export interface TotaisNota {
  produtos: number;
  desconto: number;
  frete: number;
  seguro: number;
  outras: number;
  icms: number;
  icmsSt: number;
  ipi: number;
  pis: number;
  cofins: number;
  nota: number;
}

export interface NotaImportada {
  /** Identificador local do lote (não é a chave da nota). */
  id: string;
  arquivo: string;
  formato: "xml" | "pdf";
  /** Leitura exata (XML) ou assistida, que precisa de conferência (PDF). */
  confiavel: boolean;
  chave: string;
  numero: string;
  serie: string;
  emissao: string;
  emitente: ParteNota;
  destinatario: ParteNota;
  totais: TotaisNota;
  itens: ItemNota[];
  avisos: string[];
}

export interface LeituraNota {
  nota: NotaImportada | null;
  erro: string | null;
}

export function parteVazia(): ParteNota {
  return { nome: "", cnpj: "", uf: "" };
}

export function tributoVazio(): TributoItem {
  return { cst: "", base: 0, aliquota: 0, valor: 0 };
}

export function totaisVazios(): TotaisNota {
  return {
    produtos: 0,
    desconto: 0,
    frete: 0,
    seguro: 0,
    outras: 0,
    icms: 0,
    icmsSt: 0,
    ipi: 0,
    pis: 0,
    cofins: 0,
    nota: 0,
  };
}

/** Mercadoria importada segundo o código de origem da NF-e. */
export function ehImportada(origem: string): boolean {
  return ["1", "2", "3", "6", "7", "8"].includes((origem ?? "").trim());
}
