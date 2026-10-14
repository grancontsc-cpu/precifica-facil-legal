/**
 * Tipos do simulador de precificação "Precifica Grancont".
 *
 * Todos os valores monetários e percentuais são armazenados como `number`
 * normalizado (ponto decimal). A conversão de/para o formato brasileiro
 * acontece apenas na camada de interface (src/lib/format.ts).
 */

/** Como o tributo se comporta em relação ao valor informado. */
export type TaxTreatment = "incluido" | "porFora" | "informativo";

/** Direito ao crédito — independente da alíquota. */
export type CreditMode = "nao" | "integral" | "parcial" | "manual";

/** Origem da base de cálculo do tributo. */
export type BaseMode = "padrao" | "manual";

export type PurchaseTaxId =
  | "icms"
  | "pis"
  | "cofins"
  | "ipi"
  | "ibs"
  | "cbs"
  | "icmsSt"
  | "icmsFronteira"
  | "outroCompra";

export type SaleTaxId =
  | "icmsVenda"
  | "pisVenda"
  | "cofinsVenda"
  | "ipiVenda"
  | "ibsVenda"
  | "cbsVenda"
  | "seletivoVenda"
  | "dasVenda"
  | "outroVenda";

/** Regime tributário da empresa que está precificando. */
export type Regime = "simples" | "presumido" | "real" | "mei";

/** Marco temporal da Reforma Tributária (EC 132/2023 e LC 214/2025). */
export type MarcoTemporal = "atual" | "transicao2026" | "vigencia2027" | "definitivo2033";

/** Forma de apuração do IBS/CBS por empresa do Simples Nacional. */
export type ModeloSimples = "puro" | "hibrido";

/** Enquadramento do fornecedor da mercadoria. */
export type RegimeFornecedor = "regular" | "simplesPuro" | "simplesHibrido";

/** Finalidade da compra (por enquanto o simulador cobre revenda). */
export type FinalidadeCompra = "revenda";

/**
 * Contexto fiscal da operação: regime da empresa e trajeto da mercadoria.
 * É a partir daqui que o motor deriva o ICMS de fronteira (DIFAL/antecipação).
 */
export interface OperacaoFiscal {
  regime: Regime;
  /** UF de onde a mercadoria está vindo. */
  ufOrigem: string;
  /** UF da empresa que está comprando. */
  ufDestino: string;
  finalidade: FinalidadeCompra;
  /** Mercadoria importada (alíquota interestadual de 4%). */
  importada: boolean;
  /** Calcular o ICMS de fronteira automaticamente. */
  difalAtivo: boolean;
  /** Alíquota interna do destino em % (vinda da tabela ou ajustada). */
  aliquotaInternaDestino: number | null;
  /** Alíquota interestadual origem -> destino em %. */
  aliquotaInterestadual: number | null;
  /** Valor de fronteira informado manualmente (sobrepõe o cálculo). */
  difalManual: number | null;
  /** Sobrepõe a regra de crédito do regime (null = decide pelo regime). */
  creditarDifal: boolean | null;
  /** Alíquota efetiva do DAS em % (apenas Simples/MEI). */
  aliquotaSimples: number;
  /** Período fiscal da reforma (ausente = "atual"). */
  marcoTemporal?: MarcoTemporal;
  /** Simples Nacional puro (IBS/CBS no DAS) ou híbrido (IBS/CBS por fora). */
  modeloSimples?: ModeloSimples;
  /** Enquadramento do fornecedor de origem. */
  regimeFornecedor?: RegimeFornecedor;
}

export interface PurchaseTax {
  id: PurchaseTaxId;
  label: string;
  descricao: string;
  enabled: boolean;
  /** Alíquota em % (0 a 100). */
  rate: number;
  baseMode: BaseMode;
  /** Base informada manualmente (total da nota), usada quando baseMode = "manual". */
  baseManual: number;
  /** Redução de base em % (0 a 100). */
  baseReduction: number;
  /** Quando verdadeiro, usa o valor destacado na nota em vez de calcular. */
  useManualTax: boolean;
  manualTaxValue: number;
  treatment: TaxTreatment;
  creditMode: CreditMode;
  /** Percentual de crédito quando creditMode = "parcial". */
  creditPercent: number;
  /** Valor de crédito informado manualmente quando creditMode = "manual". */
  creditManual: number;
  note: string;
}

export interface SaleTax {
  id: SaleTaxId;
  label: string;
  descricao: string;
  enabled: boolean;
  rate: number;
  baseMode: BaseMode;
  /** Base fixa informada manualmente (por unidade). */
  baseManual: number;
  treatment: TaxTreatment;
}

export type ScenarioId =
  | "atual"
  | "transicao"
  | "novo"
  | "personalizado"
  | "transicao2026"
  | "vigencia2027";

export interface ProdutoCompra {
  nome: string;
  sku: string;
  ncm: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  descontoTotal: number;
  freteTotal: number;
  seguroTotal: number;
  outrasDespesas: number;
  embalagemPorUnidade: number;
  rateioPorUnidade: number;
}

export type PricingMode = "margem" | "analise";
export type MarginBase = "precoFinal" | "precoBase";

export interface VendaConfig {
  modo: PricingMode;
  /** Margem desejada em % (modo A). */
  margemDesejada: number;
  /** Preço informado pelo usuário (modo B) — preço final cobrado. */
  precoInformado: number;
  comissaoPercent: number;
  cartaoPercent: number;
  marketplacePercent: number;
  perdasPercent: number;
  outrosPercent: number;
  freteVendaUnidade: number;
  embalagemVendaUnidade: number;
  custoFixoUnidade: number;
  outrasDespesasFixasUnidade: number;
  baseMargem: MarginBase;
}

export interface SimulationState {
  produto: ProdutoCompra;
  cenario: ScenarioId;
  tributosCompra: PurchaseTax[];
  venda: VendaConfig;
  tributosVenda: SaleTax[];
  modoAvancado: boolean;
  /** Contexto fiscal (regime + UFs). Opcional para simulações salvas antes desta versão. */
  operacao?: OperacaoFiscal;
  /** Tabela editável das etapas da reforma usada na projeção ano a ano. */
  etapasReforma?: EtapaReforma[];
  /** Premissas de referência revisadas pelo usuário (id:valor), salvas com a simulação. */
  premissasConfirmadas?: string[];
}

/** Uma etapa (ano) da transição da Reforma Tributária. */
export interface EtapaReforma {
  ano: string;
  marco: MarcoTemporal;
  /** Alíquota de CBS em %. */
  cbs: number;
  /** Alíquota de IBS em % (UF + município). */
  ibs: number;
  /** Percentual da alíquota de ICMS ainda vigente (100 = integral, 0 = extinto). */
  fatorIcms: number;
}

/* ------------------------------------------------------------------ */
/* Resultados                                                          */
/* ------------------------------------------------------------------ */

export interface PurchaseTaxResult {
  id: PurchaseTaxId;
  label: string;
  enabled: boolean;
  rate: number;
  base: number;
  valor: number;
  treatment: TaxTreatment;
  creditMode: CreditMode;
  credito: number;
  origemValor: string;
  origemCredito: string;
}

export interface PurchaseResult {
  valorBrutoProdutos: number;
  desconto: number;
  valorProdutosLiquido: number;
  outrosCustosAquisicao: number;
  valorBaseAquisicao: number;
  tributosPorFora: number;
  tributosIncluidos: number;
  tributosInformativos: number;
  desembolsoTotal: number;
  creditosTotais: number;
  custoLiquidoTotal: number;
  custoLiquidoUnitario: number;
  /** Custo líquido unitário em precisão plena (string Decimal), sem arredondamento. */
  custoLiquidoUnitarioExato: string;
  valorMedioUnitario: number;
  tributos: PurchaseTaxResult[];
}

export interface SaleTaxResult {
  id: SaleTaxId;
  label: string;
  rate: number;
  base: number;
  valor: number;
  treatment: TaxTreatment;
}

export interface SaleEvaluation {
  precoBase: number;
  tributosIncluidos: number;
  tributosPorFora: number;
  tributosInformativos: number;
  precoFinal: number;
  despesasVariaveis: number;
  despesasFixasUnidade: number;
  custoLiquidoUnitario: number;
  resultadoUnidade: number;
  margemEfetiva: number;
  markupMultiplicador: number;
  markupPercentual: number;
  tributos: SaleTaxResult[];
}

export interface ValidationIssue {
  campo: string;
  mensagem: string;
  severidade: "erro" | "aviso";
}

export interface SimulationResult {
  compra: PurchaseResult;
  precoMinimo: SaleEvaluation | null;
  recomendado: SaleEvaluation | null;
  issues: ValidationIssue[];
  impossivel: boolean;
  mensagemImpossivel: string | null;
}
