/**
 * Eventos de produto enviados ao Google Analytics.
 *
 * Todos passam por `registrarEvento`, que só entrega algo quando a tag do GA
 * foi carregada — ou seja, apenas após o consentimento LGPD do usuário.
 * Nunca envie aqui dados que identifiquem a empresa ou o usuário.
 */
import { registrarEvento } from "./analytics";

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
  registrarEvento("simulacao_iniciada", {
    modo_simulador: params.modo,
    origem_simulacao: params.origem,
  });
}

/** O usuário alterou um parâmetro fiscal (regime, UF, alíquota, crédito...). */
export function eventoParametroFiscal(params: {
  modo: ModoAnalytics;
  campo: string;
  valor?: string | number | boolean;
}) {
  const chave = `${params.modo}:${params.campo}`;
  if (!permitido(chave, JANELA_PARAMETRO_MS)) return;
  registrarEvento("parametro_fiscal_alterado", {
    modo_simulador: params.modo,
    campo_fiscal: params.campo,
    valor_fiscal: params.valor === undefined ? undefined : String(params.valor),
  });
}

/** O usuário pediu o resultado ("Simular" / "Ver preço sugerido"). */
export function eventoSimular(params: {
  modo: ModoAnalytics;
  regime?: string;
  ufOrigem?: string;
  ufDestino?: string;
  possuiResultado: boolean;
}) {
  registrarEvento("simular", {
    modo_simulador: params.modo,
    regime: params.regime,
    uf_origem: params.ufOrigem || undefined,
    uf_destino: params.ufDestino || undefined,
    resultado_valido: params.possuiResultado,
  });
}

export type FormatoExportacao = "imprimir" | "pdf" | "csv" | "whatsapp";

/** O usuário exportou/baixou o relatório de precificação. */
export function eventoExportarRelatorio(params: {
  formato: FormatoExportacao;
  modo?: ModoAnalytics;
  comComparacao?: boolean;
}) {
  registrarEvento("exportar_relatorio", {
    formato_exportacao: params.formato,
    modo_simulador: params.modo,
    com_comparacao: params.comComparacao,
  });
}

/** O usuário copiou o resultado para a área de transferência. */
export function eventoCopiarResultado(params: {
  conteudo: "resumo_whatsapp" | string;
  sucesso: boolean;
  modo?: ModoAnalytics;
}) {
  registrarEvento("copiar_resultado", {
    conteudo_copiado: params.conteudo,
    copia_sucesso: params.sucesso,
    modo_simulador: params.modo,
  });
}
