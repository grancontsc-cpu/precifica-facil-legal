import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { erro, ok, supabaseForUser } from "../supabase";
import {
  montarTabela,
  sincronizarOperacao,
  tabelaVazia,
  type LinhaInterestadual,
  type LinhaInterna,
} from "@/lib/aliquotas";
import { aplicarRegime, estadoInicial, operacaoPadrao } from "@/lib/pricing-defaults";
import { simular } from "@/lib/pricing-engine";
import type { Regime, SimulationState } from "@/types/pricing";

export default defineTool({
  name: "simular_preco",
  title: "Simular preço de venda",
  description:
    "Calcula o preço de venda recomendado com o mesmo motor do simulador (modo rápido): usa as alíquotas de ICMS internas e interestaduais cadastradas e trata o ICMS de fronteira como crédito (Lucro Real/Presumido) ou custo puro (Simples/MEI). Resultado aproximado — a versão completa permite mais premissas.",
  inputSchema: {
    produto: z.string().trim().min(1).describe("Nome do produto."),
    valor_unitario: z.number().positive().describe("Valor unitário de compra, em reais."),
    quantidade: z.number().int().min(1).default(1).describe("Quantidade comprada."),
    margem_desejada: z.number().min(0).max(99).default(30).describe("Margem desejada, em %."),
    uf_origem: z.string().length(2).describe("UF de origem da mercadoria (ex.: RJ)."),
    uf_destino: z.string().length(2).describe("UF de destino / da empresa (ex.: BA)."),
    regime: z
      .enum(["real", "presumido", "simples", "mei"])
      .default("real")
      .describe("Regime tributário da empresa compradora."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (entrada, ctx) => {
    if (!ctx.isAuthenticated()) return erro("Não autenticado.");
    const supabase = supabaseForUser(ctx);

    const [internas, interestaduais] = await Promise.all([
      supabase
        .from("icms_aliquotas_internas")
        .select("uf, aliquota, fcp, vigencia_inicio, vigencia_fim, fonte, observacao, updated_at"),
      supabase
        .from("icms_aliquotas_interestaduais")
        .select(
          "uf_origem, uf_destino, aliquota, aliquota_importado, vigencia_inicio, vigencia_fim, fonte, updated_at",
        ),
    ]);
    if (internas.error) return erro(internas.error.message);
    if (interestaduais.error) return erro(interestaduais.error.message);

    const tabela = montarTabela(
      (internas.data ?? []) as unknown as LinhaInterna[],
      (interestaduais.data ?? []) as unknown as LinhaInterestadual[],
    ) ?? tabelaVazia();

    const regime = entrada.regime as Regime;
    const base = aplicarRegime(estadoInicial(), regime);
    const operacao = sincronizarOperacao(
      operacaoPadrao({
        regime,
        ufOrigem: entrada.uf_origem.toUpperCase(),
        ufDestino: entrada.uf_destino.toUpperCase(),
      }),
      tabela,
    );

    const estado: SimulationState = {
      ...base,
      produto: {
        ...base.produto,
        nome: entrada.produto,
        quantidade: entrada.quantidade ?? 1,
        valorUnitario: entrada.valor_unitario,
      },
      venda: { ...base.venda, margemDesejada: entrada.margem_desejada ?? 30 },
      operacao,
    };

    const resultado = simular(estado);
    if (resultado.impossivel || !resultado.recomendado) {
      return erro(
        resultado.mensagemImpossivel ??
          "Não foi possível chegar a um preço com as premissas informadas.",
      );
    }

    const r = resultado.recomendado;
    return ok({
      produto: entrada.produto,
      regime,
      trajeto: { origem: operacao.ufOrigem, destino: operacao.ufDestino },
      aliquotas: {
        interna_destino: operacao.aliquotaInternaDestino,
        interestadual: operacaoInterestadual(operacao.aliquotaInterestadual),
      },
      compra: {
        desembolso_total: resultado.compra.desembolsoTotal,
        credito_total: resultado.compra.creditoTotal,
        custo_liquido_unitario: resultado.compra.custoLiquidoUnitario,
      },
      venda: {
        preco_recomendado: r.precoFinal,
        margem_efetiva: r.margemEfetiva,
        custo_liquido_unitario: r.custoLiquidoUnitario,
        resultado_unidade: r.resultadoUnidade,
      },
      avisos: resultado.issues,
      observacao:
        "Estimativa aproximada baseada nas alíquotas gerais do trajeto. Use o simulador completo no app para premissas específicas (ST, benefícios, despesas).",
    });
  },
});

function operacaoInterestadual(valor: number | null | undefined) {
  return valor ?? null;
}
