import type { SimulationResult, SimulationState } from "@/types/pricing";

export const CHAVE_RASCUNHO = "precifica-grancont:rascunho";

/** Grava o estado do modo rápido como rascunho do simulador completo. */
export function enviarParaCompleto(state: SimulationState) {
  try {
    localStorage.setItem(
      CHAVE_RASCUNHO,
      JSON.stringify({ state, salvoEm: new Date().toISOString() }),
    );
  } catch {
    // sem storage disponível: o simulador abre com o estado padrão
  }
}

export type StatusParcela = "igual" | "pode-mudar" | "so-completo";

export interface LinhaComparativo {
  id: string;
  rotulo: string;
  valorRapido: number;
  status: StatusParcela;
  motivo: string;
}

export interface GrupoComparativo {
  titulo: string;
  linhas: LinhaComparativo[];
}

/**
 * Monta o comparativo entre o que o modo rápido calculou e o que o modo
 * completo detalha, apontando parcela a parcela o que pode mudar e por quê.
 * Não há fórmulas aqui: apenas leitura do resultado já calculado pelo motor.
 */
export function montarComparativo(
  state: SimulationState,
  resultado: SimulationResult,
): GrupoComparativo[] {
  const c = resultado.compra;
  const v = resultado.recomendado;
  const op = state.operacao;
  const semRegimeCredito = op?.regime === "simples" || op?.regime === "mei";
  const interestadual = !!op && !!op.ufOrigem && !!op.ufDestino && op.ufOrigem !== op.ufDestino;

  const compra: LinhaComparativo[] = [
    {
      id: "produtos",
      rotulo: "Valor dos produtos",
      valorRapido: c.valorProdutosLiquido,
      status: "igual",
      motivo: "Vem direto do valor unitário e da quantidade informados.",
    },
    {
      id: "outrosCustos",
      rotulo: "Frete, seguro e outras despesas de compra",
      valorRapido: c.outrosCustosAquisicao,
      status: c.outrosCustosAquisicao > 0 ? "igual" : "pode-mudar",
      motivo:
        c.outrosCustosAquisicao > 0
          ? "Já considerado com o valor que você informou."
          : "No completo você lança frete, seguro, embalagem e rateio, que elevam o custo de aquisição.",
    },
  ];

  for (const t of c.tributos.filter((t) => t.enabled)) {
    compra.push({
      id: `compra:${t.id}`,
      rotulo: `${t.label} na compra`,
      valorRapido: t.valor,
      status: "pode-mudar",
      motivo:
        t.id === "icmsFronteira"
          ? interestadual
            ? `Estimado pela diferença entre a alíquota interna e a interestadual. No completo você informa a guia real, redução de base, MVA e ST. ${
                semRegimeCredito
                  ? "No seu regime ele é custo puro."
                  : "No seu regime ele volta como crédito."
              }`
            : "Operação dentro do mesmo estado: sem fronteira."
          : `Alíquota geral do regime (${t.rate}%). No completo você ajusta base, redução de base, valor destacado na nota e o direito a crédito.`,
    });
  }

  compra.push(
    {
      id: "desembolso",
      rotulo: "Desembolso total da compra",
      valorRapido: c.desembolsoTotal,
      status: "pode-mudar",
      motivo: "Muda junto com os tributos por fora e as despesas de aquisição.",
    },
    {
      id: "creditos",
      rotulo: "Créditos recuperáveis",
      valorRapido: c.creditosTotais,
      status: "pode-mudar",
      motivo: semRegimeCredito
        ? "Simples/MEI não gera crédito. No completo é possível registrar créditos específicos permitidos."
        : "No completo você define crédito integral, parcial ou manual por tributo.",
    },
    {
      id: "custoLiquido",
      rotulo: "Custo líquido unitário",
      valorRapido: c.custoLiquidoUnitario,
      status: "pode-mudar",
      motivo: "É o desembolso menos os créditos, dividido pela quantidade.",
    },
  );

  const venda: LinhaComparativo[] = [];
  if (v) {
    venda.push({
      id: "precoBase",
      rotulo: "Preço base (antes dos tributos por fora)",
      valorRapido: v.precoBase,
      status: "pode-mudar",
      motivo: "Reflete o custo líquido, a margem e os tributos embutidos na venda.",
    });
    for (const t of v.tributos) {
      venda.push({
        id: `venda:${t.id}`,
        rotulo: `${t.label} na venda`,
        valorRapido: t.valor,
        status: t.treatment === "informativo" ? "so-completo" : "pode-mudar",
        motivo:
          t.treatment === "informativo"
            ? "Hoje está como informativo: aparece no relatório, mas fora da formação do preço."
            : `Aplicado a ${t.rate}% sobre a base padrão. No completo você troca a base, o tratamento (incluído/por fora) e a alíquota.`,
      });
    }
    venda.push(
      {
        id: "despesasVariaveis",
        rotulo: "Despesas variáveis de venda",
        valorRapido: v.despesasVariaveis,
        status: v.despesasVariaveis > 0 ? "igual" : "so-completo",
        motivo:
          v.despesasVariaveis > 0
            ? "Calculadas com o percentual informado."
            : "Comissão, cartão, marketplace e perdas só entram quando informados.",
      },
      {
        id: "despesasFixas",
        rotulo: "Despesas fixas por unidade",
        valorRapido: v.despesasFixasUnidade,
        status: v.despesasFixasUnidade > 0 ? "igual" : "so-completo",
        motivo:
          v.despesasFixasUnidade > 0
            ? "Rateio informado por unidade."
            : "Custo fixo, frete de venda e embalagem por unidade existem apenas no modo completo.",
      },
      {
        id: "precoFinal",
        rotulo: "Preço final sugerido",
        valorRapido: v.precoFinal,
        status: "pode-mudar",
        motivo: "Resultado de tudo acima — tende a subir quando as parcelas faltantes entram.",
      },
      {
        id: "resultado",
        rotulo: "Resultado por unidade",
        valorRapido: v.resultadoUnidade,
        status: "pode-mudar",
        motivo: "A margem efetiva cai se despesas e tributos hoje ausentes forem incluídos.",
      },
    );
  }

  return [
    { titulo: "Compra e custo", linhas: compra },
    { titulo: "Venda e preço", linhas: venda },
  ];
}
