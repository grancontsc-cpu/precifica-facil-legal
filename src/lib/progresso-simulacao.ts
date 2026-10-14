/**
 * Transferência do modo rápido para o simulador completo e guia de
 * preenchimento. Nenhuma fórmula fiscal vive aqui.
 */
import type { SimulationState } from "@/types/pricing";

export const CHAVE_DO_RAPIDO = "precifica-grancont:do-rapido";

export function enviarDoRapido(state: SimulationState) {
  try {
    sessionStorage.setItem(CHAVE_DO_RAPIDO, JSON.stringify(state));
  } catch {
    // armazenamento indisponível: o completo abre em branco
  }
}

/** Lê e consome (uma única vez) os dados vindos do modo rápido. */
export function receberDoRapido(): SimulationState | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE_DO_RAPIDO);
    if (!bruto) return null;
    sessionStorage.removeItem(CHAVE_DO_RAPIDO);
    const s = JSON.parse(bruto) as SimulationState;
    return s?.produto ? s : null;
  } catch {
    return null;
  }
}

export type AncoraSecao = "sec-contexto" | "sec-produto" | "sec-tributos-compra" | "sec-venda";

export interface EtapaPreenchimento {
  id: string;
  rotulo: string;
  dica: string;
  feito: boolean;
  ancora: AncoraSecao;
  /** Exige o modo completo para ser editada. */
  completo: boolean;
}

export function etapasPreenchimento(s: SimulationState): EtapaPreenchimento[] {
  const p = s.produto;
  const v = s.venda;
  const op = s.operacao;
  return [
    {
      id: "produto",
      rotulo: "Produto e valor de compra",
      dica: "Nome, quantidade e valor unitário da nota.",
      feito: !!p.nome.trim() && p.valorUnitario > 0 && p.quantidade > 0,
      ancora: "sec-produto",
      completo: false,
    },
    {
      id: "trajeto",
      rotulo: "Regime e trajeto",
      dica: "Estado de origem e destino definem ICMS e fronteira.",
      feito: !!op?.ufOrigem && !!op?.ufDestino,
      ancora: "sec-contexto",
      completo: false,
    },
    {
      id: "custos",
      rotulo: "Frete, seguro e despesas da compra",
      dica: "Entram no custo e mudam o preço final.",
      feito:
        p.freteTotal > 0 ||
        p.seguroTotal > 0 ||
        p.outrasDespesas > 0 ||
        p.descontoTotal > 0 ||
        p.embalagemPorUnidade > 0,
      ancora: "sec-produto",
      completo: true,
    },
    {
      id: "tributos",
      rotulo: "Tributos da compra conferidos",
      dica: "Confira as alíquotas e créditos com a nota.",
      feito: s.tributosCompra.some((t) => t.enabled && (t.rate > 0 || t.useManualTax)),
      ancora: "sec-tributos-compra",
      completo: true,
    },
    {
      id: "despesas",
      rotulo: "Despesas de venda",
      dica: "Comissão, cartão, marketplace, frete e custo fixo.",
      feito:
        v.comissaoPercent > 0 ||
        v.cartaoPercent > 0 ||
        v.marketplacePercent > 0 ||
        v.freteVendaUnidade > 0 ||
        v.custoFixoUnidade > 0 ||
        v.embalagemVendaUnidade > 0,
      ancora: "sec-venda",
      completo: true,
    },
    {
      id: "margem",
      rotulo: "Margem ou preço de venda",
      dica: "Quanto você quer ganhar em cada venda.",
      feito: v.modo === "margem" ? v.margemDesejada > 0 : v.precoInformado > 0,
      ancora: "sec-venda",
      completo: false,
    },
  ];
}
