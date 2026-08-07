/**
 * Tipos do módulo "Comparar fornecedores".
 *
 * A comparação NÃO possui fórmulas próprias de tributação: todas as contas
 * vêm de `calcularCompra()` (src/lib/pricing-engine.ts), o mesmo motor usado
 * pelo simulador principal.
 */
import type { ProdutoCompra, PurchaseResult, PurchaseTax } from "@/types/pricing";

/** Máximo de alternativas comparáveis simultaneamente. */
export const MAX_ALTERNATIVAS = 5;

/** Regime tributário do fornecedor — campo apenas informativo. */
export type RegimeFornecedor =
  | "naoInformado"
  | "simples"
  | "presumido"
  | "real"
  | "mei"
  | "produtorRural";

export interface SupplierAlternative {
  id: string;
  /** Nome do fornecedor. */
  nome: string;
  /** UF de origem da mercadoria. */
  uf: string;
  /** Apenas informativo — nunca entra no cálculo. */
  regime: RegimeFornecedor;
  /** Prazo de pagamento em dias. */
  prazoDias: number;
  valorUnitario: number;
  quantidade: number;
  descontoTotal: number;
  freteTotal: number;
  seguroTotal: number;
  /** Outras despesas da aquisição (total do pedido). */
  outrasDespesas: number;
  /** Tributos da compra, créditos e ICMS-ST — mesma estrutura do simulador. */
  tributos: PurchaseTax[];
  observacao: string;
}

export interface SupplierComparisonRow {
  id: string;
  nome: string;
  uf: string;
  regime: RegimeFornecedor;
  prazoDias: number;
  quantidade: number;
  compra: PurchaseResult;
  desembolsoTotal: number;
  creditosTotais: number;
  custoLiquidoTotal: number;
  custoLiquidoUnitario: number;
  /** Referência usada na comparação (melhor concorrente para o vencedor). */
  referenciaId: string | null;
  /** custo unitário desta opção − custo unitário da referência (negativo = vantagem). */
  diferencaUnitaria: number;
  /** Diferença percentual em relação à referência. */
  diferencaPercentual: number;
  /** Economia (positiva) ou custo extra (negativo) no pedido inteiro. */
  economiaPedido: number;
  /**
   * Frete adicional (R$ no total do pedido) que esta opção ainda suporta
   * antes de empatar com a referência. Negativo = frete que precisaria ser
   * reduzido para empatar. `null` quando não há ponto de equilíbrio.
   */
  limiteFreteAdicional: number | null;
  destaques: DestaqueId[];
}

export type DestaqueId =
  | "menorDesembolso"
  | "menorCustoLiquido"
  | "maiorCredito"
  | "melhorPrazo"
  | "melhorOpcao";

export interface SupplierComparison {
  linhas: SupplierComparisonRow[];
  vencedorId: string | null;
  vice: string | null;
  /** Alertas de dados (quantidades divergentes, valores inválidos etc.). */
  avisos: string[];
  /** Explicação detalhada, por alternativa, do porquê do resultado. */
  explicacoes: ExplicacaoFornecedor[];
}

export interface ExplicacaoFornecedor {
  id: string;
  titulo: string;
  linhas: string[];
}

/** Converte a alternativa no `ProdutoCompra` consumido pelo motor. */
export function alternativaParaProduto(
  alt: SupplierAlternative,
  nomeProduto: string,
  freteExtra = 0,
): ProdutoCompra {
  return {
    nome: nomeProduto,
    sku: "",
    ncm: "",
    unidade: "unidade",
    quantidade: alt.quantidade,
    valorUnitario: alt.valorUnitario,
    descontoTotal: alt.descontoTotal,
    freteTotal: alt.freteTotal + freteExtra,
    seguroTotal: alt.seguroTotal,
    outrasDespesas: alt.outrasDespesas,
    embalagemPorUnidade: 0,
    rateioPorUnidade: 0,
  };
}
