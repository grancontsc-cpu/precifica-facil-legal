/**
 * Eventos de produto enviados ao Google Analytics.
 *
 * Todos passam por `registrarEvento`, que só entrega algo quando a tag do GA
 * foi carregada — ou seja, apenas após o consentimento LGPD do usuário.
 * Nunca envie aqui dados que identifiquem a empresa ou o usuário.
 */
import { registrarEvento } from "./analytics";
import { registrarEventoInterno } from "./metricas-internas";

/** Envia ao GA4 e grava o mesmo evento no painel interno de métricas. */
function enviar(nome: string, parametros: Record<string, unknown>, modo?: string) {
  registrarEvento(nome, parametros);
  registrarEventoInterno(nome, { modo, parametros });
}

export type ModoAnalytics = "rapido" | "simples" | "completo";

/** Janela (ms) para agrupar alterações repetidas do mesmo parâmetro. */
export const JANELA_PARAMETRO_MS = 1500;

const ultimoEnvio = new Map<string, number>();

function agora() {
  return Date.now();
}

/** Evita inundar o GA quando o usuário arrasta um campo numérico. */
function permitido(chave: string, janelaMs: number) {
  const t = agora();
  const anterior = ultimoEnvio.get(chave);
  if (anterior !== undefined && t - anterior < janelaMs) return false;
  ultimoEnvio.set(chave, t);
  return true;
}

/** Apenas para os testes: limpa o controle de repetição. */
export function reiniciarControleEventos() {
  ultimoEnvio.clear();
}

/** O usuário abriu/começou uma nova simulação. */
export function eventoSimulacaoIniciada(params: {
  modo: ModoAnalytics;
  origem: "nova" | "carregada" | "exemplo" | "duplicada";
}) {
  enviar(
    "simulacao_iniciada",
    { modo_simulador: params.modo, origem_simulacao: params.origem },
    params.modo,
  );
}

/** O usuário alterou um parâmetro fiscal (regime, UF, alíquota, crédito...). */
export function eventoParametroFiscal(params: {
  modo: ModoAnalytics;
  campo: string;
  valor?: string | number | boolean;
}) {
  const chave = `${params.modo}:${params.campo}`;
  if (!permitido(chave, JANELA_PARAMETRO_MS)) return;
  enviar(
    "parametro_fiscal_alterado",
    {
      modo_simulador: params.modo,
      campo_fiscal: params.campo,
      valor_fiscal: params.valor === undefined ? undefined : String(params.valor),
    },
    params.modo,
  );
}

/** O usuário pediu o resultado ("Simular" / "Ver preço sugerido"). */
export function eventoSimular(params: {
  modo: ModoAnalytics;
  regime?: string;
  ufOrigem?: string;
  ufDestino?: string;
  possuiResultado: boolean;
}) {
  enviar(
    "simular",
    {
      modo_simulador: params.modo,
      regime: params.regime,
      uf_origem: params.ufOrigem || undefined,
      uf_destino: params.ufDestino || undefined,
      resultado_valido: params.possuiResultado,
    },
    params.modo,
  );
}

/** Conversão: a simulação chegou a um preço recomendado válido. */
export function eventoSimulacaoConcluida(params: {
  modo: ModoAnalytics;
  regime?: string;
  ufOrigem?: string;
  ufDestino?: string;
  chave?: string;
}) {
  const chave = `concluida:${params.modo}:${params.chave ?? ""}`;
  if (!permitido(chave, JANELA_PARAMETRO_MS)) return;
  enviar(
    "simulacao_concluida",
    {
      modo_simulador: params.modo,
      regime: params.regime,
      uf_origem: params.ufOrigem || undefined,
      uf_destino: params.ufDestino || undefined,
    },
    params.modo,
  );
}

export type FormatoExportacao = "imprimir" | "pdf" | "csv" | "whatsapp";

/** O usuário exportou/baixou o relatório de precificação. */
export function eventoExportarRelatorio(params: {
  formato: FormatoExportacao;
  modo?: ModoAnalytics;
  comComparacao?: boolean;
}) {
  enviar(
    "exportar_relatorio",
    {
      formato_exportacao: params.formato,
      modo_simulador: params.modo,
      com_comparacao: params.comComparacao,
    },
    params.modo,
  );
}

/** O usuário copiou o resultado para a área de transferência. */
export function eventoCopiarResultado(params: {
  conteudo: "resumo_whatsapp" | string;
  sucesso: boolean;
  modo?: ModoAnalytics;
}) {
  enviar(
    "copiar_resultado",
    {
      conteudo_copiado: params.conteudo,
      copia_sucesso: params.sucesso,
      modo_simulador: params.modo,
    },
    params.modo,
  );
}

/** Seções de detalhamento das parcelas do resultado. */
export type SecaoDetalhamento = "memoria_calculo" | "fronteira" | "suposicoes_fiscais";

/**
 * O usuário expandiu (ou recolheu) o detalhamento das parcelas do resultado:
 * custos de compra, tributos e margem.
 */
export function eventoDetalhamentoResultado(params: {
  secao: SecaoDetalhamento;
  aberto: boolean;
  modo?: ModoAnalytics;
  comComparacao?: boolean;
}) {
  enviar(
    "detalhamento_resultado",
    {
      secao_detalhamento: params.secao,
      detalhamento_aberto: params.aberto,
      modo_simulador: params.modo,
      com_comparacao: Boolean(params.comComparacao),
    },
    params.modo,
  );
}
