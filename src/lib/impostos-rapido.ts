import type { Regime, SimulationState } from "@/types/pricing";

/**
 * Perguntas simples de tributação usadas no modo rápido.
 * Nenhuma fórmula vive aqui: o arquivo apenas traduz as respostas do usuário
 * em premissas (alíquotas e tributos habilitados) para o motor de cálculo.
 */
export type Resposta = "sim" | "nao" | "naoSei";

export interface RespostasImpostos {
  /** A mercadoria é tributada pelo ICMS? */
  icms: Resposta;
  /** A mercadoria é tributada por PIS/Cofins? */
  pisCofins: Resposta;
  /** Alíquotas de PIS/Cofins sobrepostas pelo usuário (null = usa a sugestão). */
  aliquotaPis: number | null;
  aliquotaCofins: number | null;
}

export function respostasPadrao(): RespostasImpostos {
  return { icms: "naoSei", pisCofins: "naoSei", aliquotaPis: null, aliquotaCofins: null };
}

/**
 * "Não sei" é tratado como tributado: é a hipótese prudente para a
 * precificação (evita preço abaixo do custo por tributo esquecido).
 */
export function tributado(r: Resposta): boolean {
  return r !== "nao";
}

export function apuraPeloSimplesRegime(regime: Regime): boolean {
  return regime === "simples" || regime === "mei";
}

/**
 * Sugestões iniciais de PIS/Cofins por regime. São apenas valores de partida,
 * editáveis pelo usuário — a apuração real depende do enquadramento.
 */
export function sugestaoPisCofins(regime: Regime): { pis: number; cofins: number } {
  return regime === "real" ? { pis: 1.65, cofins: 7.6 } : { pis: 0.65, cofins: 3 };
}

/** Alíquota de ICMS aplicável à compra conforme o trajeto informado. */
export function aliquotaIcmsCompra(state: SimulationState): number | null {
  const op = state.operacao;
  if (!op) return null;
  const interestadual = op.ufOrigem && op.ufDestino && op.ufOrigem !== op.ufDestino;
  return interestadual ? op.aliquotaInterestadual : op.aliquotaInternaDestino;
}

/**
 * Aplica as respostas sobre o estado montado por padrão.
 * No Simples/MEI o ICMS e o PIS/Cofins não são apurados por fora do DAS:
 * a única alíquota relevante é a efetiva do Simples.
 */
export function aplicarRespostas(
  state: SimulationState,
  r: RespostasImpostos,
): SimulationState {
  const op = state.operacao;
  const regime = op?.regime ?? "real";

  if (apuraPeloSimplesRegime(regime)) {
    return {
      ...state,
      tributosCompra: state.tributosCompra.map((t) =>
        t.id === "icms" || t.id === "pis" || t.id === "cofins"
          ? { ...t, enabled: false, rate: 0, creditMode: "nao" as const }
          : t,
      ),
    };
  }

  const comIcms = tributado(r.icms);
  const comPisCofins = tributado(r.pisCofins);
  const sug = sugestaoPisCofins(regime);
  const pis = r.aliquotaPis ?? sug.pis;
  const cofins = r.aliquotaCofins ?? sug.cofins;

  const compraIcms = comIcms ? (aliquotaIcmsCompra(state) ?? 0) : 0;
  const vendaIcms = comIcms ? (op?.aliquotaInternaDestino ?? 0) : 0;

  return {
    ...state,
    operacao: op ? { ...op, difalAtivo: comIcms ? op.difalAtivo : false } : op,
    tributosCompra: state.tributosCompra.map((t) => {
      if (t.id === "icms") return { ...t, enabled: comIcms, rate: compraIcms };
      if (t.id === "pis") return { ...t, enabled: comPisCofins, rate: comPisCofins ? pis : 0 };
      if (t.id === "cofins")
        return { ...t, enabled: comPisCofins, rate: comPisCofins ? cofins : 0 };
      return t;
    }),
    tributosVenda: state.tributosVenda.map((t) => {
      if (t.id === "icmsVenda") return { ...t, enabled: comIcms, rate: vendaIcms };
      if (t.id === "pisVenda") return { ...t, enabled: comPisCofins, rate: comPisCofins ? pis : 0 };
      if (t.id === "cofinsVenda")
        return { ...t, enabled: comPisCofins, rate: comPisCofins ? cofins : 0 };
      return t;
    }),
  };
}
