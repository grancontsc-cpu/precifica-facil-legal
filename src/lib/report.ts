/**
 * Montagem do relatório profissional de simulação.
 *
 * Este módulo NÃO contém fórmulas de precificação: ele apenas lê o que o
 * motor (`simular()` / `compararFornecedores()`) já calculou e organiza os
 * dados para impressão, PDF, CSV e WhatsApp.
 */
import { formatBRL, formatData, formatNumero, formatPercent, formatQuantidade } from "@/lib/format";
import { REGIMES } from "@/lib/comparison-defaults";
import { apuraPeloSimples, calcularFronteira, creditaFronteiraPorRegime, nomeRegime } from "@/lib/pricing-engine";
import type { SimulationResult, SimulationState } from "@/types/pricing";
import type { SupplierComparison } from "@/types/comparison";

export const AVISO_GERENCIAL =
  "Aviso: esta é uma simulação gerencial de precificação, não constitui apuração fiscal nem parecer tributário. " +
  "O tratamento tributário depende de produto, NCM, CST, CFOP, origem, destino, regime, benefícios fiscais e direito a crédito. " +
  "Confirme as premissas com a contabilidade antes de aplicar os preços.";

export interface LinhaRelatorio {
  rotulo: string;
  valor: string;
  detalhe?: string;
  destaque?: boolean;
}

export interface BlocoRelatorio {
  titulo: string;
  descricao?: string;
  linhas: LinhaRelatorio[];
}

export interface RelatorioMeta {
  empresa: string;
  produto: string;
  tituloSimulacao: string;
  perfilTributario: string;
  dataSimulacao: Date;
  emitidoPor?: string;
  camposAlterados?: string[];
  camposBloqueados?: string[];
  observacoes?: string;
}

export interface Relatorio {
  meta: RelatorioMeta;
  blocos: BlocoRelatorio[];
  comparacao: BlocoRelatorio | null;
  premissas: string[];
  observacoes: string;
  aviso: string;
  resumo: {
    produto: string;
    custoLiquidoUnitario: number;
    precoSugerido: number | null;
    margem: number | null;
    principalObservacao: string;
  };
}

const TRATAMENTO: Record<string, string> = {
  incluido: "incluído no valor",
  porFora: "acrescentado por fora",
  informativo: "apenas informativo",
};

const CREDITO: Record<string, string> = {
  nao: "sem crédito",
  integral: "crédito integral",
  parcial: "crédito parcial",
  manual: "crédito informado",
};

const CENARIO: Record<string, string> = {
  atual: "Modelo atual (ICMS, PIS, Cofins, IPI)",
  transicao: "Transição da reforma",
  transicao2026: "Transição 2026 (IBS 0,10% e CBS 0,90%)",
  novo: "Modelo pleno IBS/CBS",
  personalizado: "Configuração personalizada",
};

function nomeRegime(id: string) {
  return REGIMES.find((r) => r.id === id)?.label ?? "Não informado";
}

/** Monta o relatório completo a partir do estado e do resultado do motor. */
export function montarRelatorio(
  state: SimulationState,
  resultado: SimulationResult,
  meta: RelatorioMeta,
  comparacao?: SupplierComparison | null,
): Relatorio {
  const c = resultado.compra;
  const venda = resultado.recomendado;
  const minimo = resultado.precoMinimo;
  const q = state.produto.quantidade;

  const dadosCompra: BlocoRelatorio = {
    titulo: "Dados da compra",
    descricao: "Valores conforme informados na nota de aquisição.",
    linhas: [
      { rotulo: "Produto", valor: state.produto.nome || "—" },
      { rotulo: "SKU / NCM", valor: [state.produto.sku, state.produto.ncm].filter(Boolean).join(" / ") || "—" },
      { rotulo: "Quantidade", valor: `${formatQuantidade(q)} ${state.produto.unidade}` },
      { rotulo: "Valor unitário de compra", valor: formatBRL(state.produto.valorUnitario) },
      { rotulo: "Valor bruto dos produtos", valor: formatBRL(c.valorBrutoProdutos) },
      { rotulo: "Desconto incondicional", valor: formatBRL(-c.desconto) },
      { rotulo: "Produtos após desconto", valor: formatBRL(c.valorProdutosLiquido) },
      { rotulo: "Frete de compra", valor: formatBRL(state.produto.freteTotal) },
      { rotulo: "Seguro", valor: formatBRL(state.produto.seguroTotal) },
      { rotulo: "Outras despesas de compra", valor: formatBRL(state.produto.outrasDespesas) },
      { rotulo: "Embalagem por unidade", valor: formatBRL(state.produto.embalagemPorUnidade) },
      { rotulo: "Rateio por unidade", valor: formatBRL(state.produto.rateioPorUnidade) },
      { rotulo: "Base de aquisição", valor: formatBRL(c.valorBaseAquisicao) },
      { rotulo: "Valor médio por unidade", valor: formatBRL(c.valorMedioUnitario) },
    ],
  };

  const tributos: BlocoRelatorio = {
    titulo: "Tributos e créditos da compra",
    descricao: "Alíquota, base, tratamento e direito a crédito de cada tributo.",
    linhas: c.tributos
      .filter((t) => t.enabled)
      .map((t) => ({
        rotulo: t.label,
        valor: `${formatBRL(t.valor)} | crédito ${formatBRL(t.credito)}`,
        detalhe:
          `Alíquota ${formatPercent(t.rate)} sobre base ${formatBRL(t.base)} — ` +
          `${TRATAMENTO[t.treatment] ?? t.treatment}; ${CREDITO[t.creditMode] ?? t.creditMode}. ` +
          `${t.origemValor} ${t.origemCredito}`.trim(),
      })),
  };
  if (tributos.linhas.length === 0) {
    tributos.linhas.push({ rotulo: "Nenhum tributo habilitado", valor: "—" });
  }

  const custo: BlocoRelatorio = {
    titulo: "Custo líquido de aquisição",
    descricao: "Memória do desembolso, dos créditos e do custo que efetivamente fica na empresa.",
    linhas: [
      { rotulo: "Tributos incluídos no valor pago", valor: formatBRL(c.tributosIncluidos) },
      { rotulo: "Tributos acrescentados por fora", valor: formatBRL(c.tributosPorFora) },
      { rotulo: "Tributos informativos (não somados)", valor: formatBRL(c.tributosInformativos) },
      { rotulo: "Desembolso total", valor: formatBRL(c.desembolsoTotal), destaque: true },
      { rotulo: "(−) Créditos recuperáveis", valor: formatBRL(c.creditosTotais) },
      { rotulo: "Custo líquido total", valor: formatBRL(c.custoLiquidoTotal), destaque: true },
      {
        rotulo: "Custo líquido unitário",
        valor: formatBRL(c.custoLiquidoUnitario),
        detalhe: `Custo líquido total ÷ ${formatQuantidade(q)} ${state.produto.unidade}`,
        destaque: true,
      },
    ],
  };

  const formacao: BlocoRelatorio = {
    titulo: "Formação do preço de venda",
    descricao:
      state.venda.modo === "margem"
        ? `Preço calculado a partir da margem desejada de ${formatPercent(state.venda.margemDesejada)}.`
        : "Análise da margem obtida com o preço informado.",
    linhas: venda
      ? [
          { rotulo: "Custo líquido unitário", valor: formatBRL(venda.custoLiquidoUnitario) },
          ...venda.tributos.map((t) => ({
            rotulo: `${t.label} sobre a venda`,
            valor: formatBRL(t.valor),
            detalhe: `Alíquota ${formatPercent(t.rate)} sobre ${formatBRL(t.base)} — ${
              TRATAMENTO[t.treatment] ?? t.treatment
            }`,
          })),
          { rotulo: "Despesas variáveis da venda", valor: formatBRL(venda.despesasVariaveis) },
          { rotulo: "Despesas fixas por unidade", valor: formatBRL(venda.despesasFixasUnidade) },
          { rotulo: "Preço base (antes dos tributos por fora)", valor: formatBRL(venda.precoBase) },
          { rotulo: "Tributos incluídos no preço", valor: formatBRL(venda.tributosIncluidos) },
          { rotulo: "Tributos por fora", valor: formatBRL(venda.tributosPorFora) },
          { rotulo: "Resultado por unidade", valor: formatBRL(venda.resultadoUnidade) },
          {
            rotulo: "Markup",
            valor: `${formatNumero(venda.markupMultiplicador, 4)}x (${formatPercent(venda.markupPercentual)})`,
          },
        ]
      : [{ rotulo: "Preço não pôde ser calculado", valor: resultado.mensagemImpossivel ?? "—" }],
  };

  const resultadoFinal: BlocoRelatorio = {
    titulo: "Preço sugerido e margem",
    linhas: venda
      ? [
          { rotulo: "Preço sugerido ao cliente", valor: formatBRL(venda.precoFinal), destaque: true },
          { rotulo: "Margem efetiva", valor: formatPercent(venda.margemEfetiva), destaque: true },
          {
            rotulo: "Base da margem",
            valor: state.venda.baseMargem === "precoFinal" ? "Preço final" : "Preço base",
          },
          {
            rotulo: "Preço de equilíbrio (margem zero)",
            valor: minimo ? formatBRL(minimo.precoFinal) : "—",
          },
          { rotulo: "Resultado no pedido inteiro", valor: formatBRL(venda.resultadoUnidade * q) },
        ]
      : [{ rotulo: "Sem preço válido", valor: resultado.mensagemImpossivel ?? "—" }],
  };

  let blocoComparacao: BlocoRelatorio | null = null;
  if (comparacao && comparacao.linhas.length > 1) {
    blocoComparacao = {
      titulo: "Comparação entre fornecedores",
      descricao: "Calculada pelo mesmo motor de custo líquido do simulador.",
      linhas: comparacao.linhas.map((l) => ({
        rotulo: `${l.nome || "Fornecedor"}${l.uf ? ` (${l.uf})` : ""}`,
        valor: `Custo líquido unitário ${formatBRL(l.custoLiquidoUnitario)}`,
        detalhe:
          `Desembolso ${formatBRL(l.desembolsoTotal)}; créditos ${formatBRL(l.creditosTotais)}; ` +
          `custo líquido total ${formatBRL(l.custoLiquidoTotal)}; prazo ${l.prazoDias} dias; ` +
          `regime ${nomeRegime(l.regime)}. ` +
          (l.id === comparacao.vencedorId
            ? "Melhor opção econômica."
            : `Diferença de ${formatBRL(l.diferencaUnitaria)} por unidade (${formatPercent(
                l.diferencaPercentual,
              )}) frente à referência.`) +
          (l.limiteFreteAdicional !== null
            ? ` Limite de frete adicional: ${formatBRL(l.limiteFreteAdicional)}.`
            : ""),
        destaque: l.id === comparacao.vencedorId,
      })),
    };
  }

  const op = state.operacao;
  const premissas: string[] = [
    ...(op
      ? [
          `Regime tributário: ${nomeRegime(op.regime)}.`,
          `Trajeto da mercadoria: ${op.ufOrigem || "origem não informada"} → ${
            op.ufDestino || "destino não informado"
          }${op.importada ? " (mercadoria importada)" : ""}.`,
          apuraPeloSimples(op.regime)
            ? `Venda tributada pelo DAS à alíquota efetiva de ${formatPercent(op.aliquotaSimples)}.`
            : `Alíquotas de ICMS usadas: interna do destino ${
                op.aliquotaInternaDestino === null ? "não cadastrada" : formatPercent(op.aliquotaInternaDestino)
              }, interestadual ${
                op.aliquotaInterestadual === null ? "não aplicável" : formatPercent(op.aliquotaInterestadual)
              }.`,
          calcularFronteira(op).aplicavel
            ? `ICMS de fronteira (diferencial de alíquotas) aplicado e ${
                creditaFronteiraPorRegime(op.regime) ? "recuperável como crédito" : "tratado como custo puro"
              }.`
            : `Sem ICMS de fronteira nesta operação.`,
        ]
      : []),
    `Cenário tributário: ${CENARIO[state.cenario] ?? state.cenario}.`,
    `Perfil tributário aplicado: ${meta.perfilTributario}.`,
    `Base da margem: ${state.venda.baseMargem === "precoFinal" ? "preço final" : "preço base"}.`,
    state.venda.modo === "margem"
      ? `Modo de cálculo: preço obtido pela margem desejada de ${formatPercent(state.venda.margemDesejada)}.`
      : `Modo de cálculo: análise do preço informado de ${formatBRL(state.venda.precoInformado)}.`,
    `Tributos incluídos no valor não aumentam o desembolso; tributos por fora são acrescentados; tributos informativos não afetam custo nem preço.`,
    `Créditos considerados apenas onde há direito configurado: ${
      c.tributos
        .filter((t) => t.enabled && t.creditMode !== "nao")
        .map((t) => t.label)
        .join(", ") || "nenhum"
    }.`,
    `Valores calculados com precisão decimal; o arredondamento ocorre somente na exibição.`,
  ];
  if (meta.camposBloqueados?.length) {
    premissas.push(`Campos bloqueados pela Grancont: ${meta.camposBloqueados.join(", ")}.`);
  }
  if (meta.camposAlterados?.length) {
    premissas.push(`Campos alterados manualmente em relação ao perfil: ${meta.camposAlterados.join(", ")}.`);
  }
  for (const issue of resultado.issues) {
    premissas.push(`${issue.severidade === "erro" ? "Erro" : "Atenção"}: ${issue.mensagem}`);
  }

  const principalObservacao =
    resultado.issues.find((i) => i.severidade === "erro")?.mensagem ??
    (meta.observacoes?.trim() ? meta.observacoes.trim().split("\n")[0] : "") ??
    "";

  const observacaoFinal =
    principalObservacao ||
    resultado.issues[0]?.mensagem ||
    (blocoComparacao
      ? "Comparação de fornecedores considerada no custo líquido."
      : "Simulação gerencial — validar tratamento tributário com a contabilidade.");

  return {
    meta,
    blocos: [dadosCompra, tributos, custo, formacao, resultadoFinal],
    comparacao: blocoComparacao,
    premissas,
    observacoes: meta.observacoes?.trim() ?? "",
    aviso: AVISO_GERENCIAL,
    resumo: {
      produto: state.produto.nome || meta.produto || "Produto",
      custoLiquidoUnitario: c.custoLiquidoUnitario,
      precoSugerido: venda?.precoFinal ?? null,
      margem: venda?.margemEfetiva ?? null,
      principalObservacao: observacaoFinal,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Exportações                                                         */
/* ------------------------------------------------------------------ */

function celula(v: string) {
  const texto = String(v ?? "").replace(/"/g, '""');
  return `"${texto}"`;
}

/** CSV com a memória completa (separador ";", compatível com Excel pt-BR). */
export function csvRelatorio(rel: Relatorio): string {
  const linhas: string[][] = [
    ["Bloco", "Item", "Valor", "Detalhe"],
    ["Identificação", "Empresa", rel.meta.empresa, ""],
    ["Identificação", "Simulação", rel.meta.tituloSimulacao, ""],
    ["Identificação", "Produto", rel.meta.produto, ""],
    ["Identificação", "Perfil tributário", rel.meta.perfilTributario, ""],
    ["Identificação", "Data da simulação", formatData(rel.meta.dataSimulacao), ""],
  ];
  if (rel.meta.emitidoPor) linhas.push(["Identificação", "Emitido por", rel.meta.emitidoPor, ""]);

  const todos = rel.comparacao ? [...rel.blocos, rel.comparacao] : rel.blocos;
  for (const bloco of todos) {
    for (const l of bloco.linhas) {
      linhas.push([bloco.titulo, l.rotulo, l.valor, l.detalhe ?? ""]);
    }
  }
  rel.premissas.forEach((p, i) => linhas.push(["Premissas", `Premissa ${i + 1}`, p, ""]));
  if (rel.observacoes) linhas.push(["Observações", "Observações", rel.observacoes, ""]);
  linhas.push(["Aviso", "Simulação gerencial", rel.aviso, ""]);

  return "\uFEFF" + linhas.map((l) => l.map(celula).join(";")).join("\r\n");
}

/** Resumo objetivo para WhatsApp. */
export function whatsappRelatorio(rel: Relatorio): string {
  const r = rel.resumo;
  const partes = [
    "*Precifica Grancont — resumo da simulação*",
    `Empresa: ${rel.meta.empresa}`,
    `Produto: ${r.produto}`,
    `Custo líquido unitário: ${formatBRL(r.custoLiquidoUnitario)}`,
    `Preço sugerido: ${r.precoSugerido === null ? "—" : formatBRL(r.precoSugerido)}`,
    `Margem: ${r.margem === null ? "—" : formatPercent(r.margem)}`,
    `Observação: ${r.principalObservacao}`,
    "",
    "Simulação gerencial. Valide as premissas com a contabilidade.",
  ];
  return partes.join("\n");
}

export function nomeArquivo(rel: Relatorio, extensao: string): string {
  const base = `${rel.meta.empresa}-${rel.resumo.produto}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const d = rel.meta.dataSimulacao;
  const data = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `${base || "simulacao"}-${data}.${extensao}`;
}

export function baixarArquivo(conteudo: string, nome: string, mime: string) {
  const blob = new Blob([conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
