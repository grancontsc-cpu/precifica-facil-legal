import { parteVazia, totaisVazios, tributoVazio, type ItemNota, type LeituraNota } from "./tipos";
import { conferir, ratearCabecalho } from "./xml";

/** Formato devolvido pelo modelo ao ler a foto da nota (todos os campos podem faltar). */
export interface TributoExtraido {
  cst: string | null;
  aliquota: number | null;
  valor: number | null;
}
export interface ItemExtraido {
  descricao: string | null;
  codigo: string | null;
  ncm: string | null;
  cfop: string | null;
  unidade: string | null;
  quantidade: number | null;
  valorUnitario: number | null;
  valorTotal: number | null;
  icms: TributoExtraido;
  ipi: TributoExtraido;
  pis: TributoExtraido;
  cofins: TributoExtraido;
  icmsSt: number | null;
}
export interface NotaExtraida {
  legivel: boolean;
  numero: string | null;
  emissao: string | null;
  emitenteNome: string | null;
  emitenteCnpj: string | null;
  emitenteUf: string | null;
  destinatarioCnpj: string | null;
  frete: number | null;
  desconto: number | null;
  seguro: number | null;
  outras: number | null;
  valorTotalNota: number | null;
  itens: ItemExtraido[];
}

const n = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
const t = (v: string | null | undefined) => (v ?? "").toString().trim();
const digitos = (v: string | null | undefined) => t(v).replace(/\D/g, "");

const TRIB_NULO: TributoExtraido = { cst: null, aliquota: null, valor: null };
function tributo(x: TributoExtraido | undefined, base: number) {
  const tr = x ?? TRIB_NULO;
  return {
    ...tributoVazio(),
    cst: t(tr.cst),
    aliquota: n(tr.aliquota),
    valor: n(tr.valor),
    base: n(tr.valor) > 0 ? base : 0,
  };
}

/** Converte a leitura da foto em nota revisável. Sempre marcada para conferência. */
export function notaDaFoto(dados: NotaExtraida, arquivo: string): LeituraNota {
  if (!dados?.legivel) {
    return {
      nota: null,
      erro: `${arquivo}: a foto não está legível. Tire outra com boa luz, sem cortes e sem reflexo.`,
    };
  }
  const itens: ItemNota[] = [];
  for (const i of dados.itens ?? []) {
    let quantidade = n(i.quantidade);
    let unitario = n(i.valorUnitario);
    let total = n(i.valorTotal);
    if (!total && quantidade && unitario) total = Number((quantidade * unitario).toFixed(2));
    if (!quantidade && total && unitario) quantidade = Number((total / unitario).toFixed(4));
    if (!quantidade && total) quantidade = 1;
    if (!unitario && quantidade && total) unitario = Number((total / quantidade).toFixed(4));
    if (quantidade <= 0 || total <= 0) continue;
    itens.push({
      numero: itens.length + 1,
      codigo: t(i.codigo),
      descricao: t(i.descricao) || `Item ${itens.length + 1}`,
      ncm: digitos(i.ncm),
      cfop: digitos(i.cfop),
      unidade: t(i.unidade) || "UN",
      quantidade,
      valorUnitario: unitario,
      valorProduto: total,
      desconto: 0,
      frete: 0,
      seguro: 0,
      outras: 0,
      origem: "",
      icms: tributo(i.icms, total),
      icmsSt: { ...tributoVazio(), valor: n(i.icmsSt) },
      fcp: 0,
      ipi: tributo(i.ipi, total),
      pis: tributo(i.pis, total),
      cofins: tributo(i.cofins, total),
    });
  }
  if (itens.length === 0) {
    return {
      nota: null,
      erro: `${arquivo}: nenhum item foi reconhecido na foto. Confira se a lista de produtos aparece inteira.`,
    };
  }
  const soma = (f: (i: ItemNota) => number) =>
    Number(itens.reduce((a, i) => a + f(i), 0).toFixed(2));
  const totais = {
    ...totaisVazios(),
    produtos: soma((i) => i.valorProduto),
    desconto: n(dados.desconto),
    frete: n(dados.frete),
    seguro: n(dados.seguro),
    outras: n(dados.outras),
    icms: soma((i) => i.icms.valor),
    icmsSt: soma((i) => i.icmsSt.valor),
    ipi: soma((i) => i.ipi.valor),
    pis: soma((i) => i.pis.valor),
    cofins: soma((i) => i.cofins.valor),
  };
  totais.nota =
    n(dados.valorTotalNota) ||
    Number(
      (
        totais.produtos -
        totais.desconto +
        totais.frete +
        totais.seguro +
        totais.outras +
        totais.ipi +
        totais.icmsSt
      ).toFixed(2),
    );

  const nota = {
    id: `foto-${arquivo}-${Date.now()}`,
    arquivo,
    formato: "pdf" as const,
    confiavel: false,
    chave: "",
    numero: digitos(dados.numero),
    serie: "",
    emissao: t(dados.emissao),
    emitente: {
      nome: t(dados.emitenteNome),
      cnpj: digitos(dados.emitenteCnpj),
      uf: t(dados.emitenteUf).toUpperCase().slice(0, 2),
    },
    destinatario: { ...parteVazia(), cnpj: digitos(dados.destinatarioCnpj) },
    totais,
    itens: ratearCabecalho(itens, totais),
    avisos: [
      "Leitura por foto feita por inteligência artificial: confira descrição, quantidade, valores e tributos de cada item antes de precificar.",
    ],
  };
  conferir(nota);
  return { nota, erro: null };
}
