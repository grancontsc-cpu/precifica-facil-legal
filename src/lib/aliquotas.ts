/**
 * Tabela de alíquotas de ICMS por estado.
 *
 * Nenhuma alíquota é fixada no código: os valores vêm das tabelas
 * `icms_aliquotas_internas` e `icms_aliquotas_interestaduais` do banco,
 * que são versionadas por vigência e editáveis pelo Administrador Geral.
 * Este módulo só organiza a consulta e mantém o snapshot usado por cada
 * simulação.
 */

export interface UfInfo {
  sigla: string;
  nome: string;
}

/** Lista das unidades federativas (dado cadastral, não fiscal). */
export const UFS: UfInfo[] = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "TO", nome: "Tocantins" },
];

export const SIGLAS_UF = UFS.map((u) => u.sigla);

export function nomeUf(sigla: string | null | undefined): string {
  if (!sigla) return "";
  return UFS.find((u) => u.sigla === sigla.toUpperCase())?.nome ?? sigla;
}

export function ufValida(sigla: string | null | undefined): boolean {
  return !!sigla && SIGLAS_UF.includes(sigla.toUpperCase());
}

/** Metadados da linha de alíquota efetivamente usada no cálculo. */
export interface DetalheAliquota {
  aliquota: number;
  /** Alíquota de mercadoria importada (apenas nas interestaduais). */
  aliquotaImportado?: number;
  fcp?: number;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  fonte: string | null;
  observacao?: string | null;
  /** Última alteração do registro no banco. */
  atualizadaEm: string | null;
}

/** Snapshot das alíquotas usadas por uma simulação. */
export interface TabelaAliquotas {
  /** UF -> alíquota interna em %. */
  internas: Record<string, number>;
  /** "ORIGEM-DESTINO" -> alíquota interestadual em %. */
  interestaduais: Record<string, number>;
  /** "ORIGEM-DESTINO" -> alíquota interestadual de mercadoria importada em %. */
  importadas: Record<string, number>;
  /** UF -> metadados da alíquota interna vigente. */
  detalhesInternas: Record<string, DetalheAliquota>;
  /** "ORIGEM-DESTINO" -> metadados da alíquota interestadual vigente. */
  detalhesInterestaduais: Record<string, DetalheAliquota>;
  /** Início de vigência mais recente presente na base (AAAA-MM-DD). */
  vigenciaMaisRecente: string | null;
  /** Data/hora da última alteração de qualquer registro da base. */
  atualizadaEm: string | null;
  /** Data/hora em que o snapshot foi capturado. */
  capturadaEm: string;
}

export function tabelaVazia(): TabelaAliquotas {
  return {
    internas: {},
    interestaduais: {},
    importadas: {},
    detalhesInternas: {},
    detalhesInterestaduais: {},
    vigenciaMaisRecente: null,
    atualizadaEm: null,
    capturadaEm: "",
  };
}

export function chavePar(origem: string, destino: string): string {
  return `${(origem ?? "").toUpperCase()}-${(destino ?? "").toUpperCase()}`;
}

/** Alíquota interna vigente do estado de destino. `null` quando não cadastrada. */
export function aliquotaInterna(tabela: TabelaAliquotas | null, uf: string): number | null {
  if (!tabela) return null;
  const v = tabela.internas[(uf ?? "").toUpperCase()];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Alíquota interestadual vigente. `null` quando o par não está cadastrado. */
export function aliquotaInterestadual(
  tabela: TabelaAliquotas | null,
  origem: string,
  destino: string,
  importada = false,
): number | null {
  if (!tabela) return null;
  const mapa = importada ? tabela.importadas : tabela.interestaduais;
  const v = mapa[chavePar(origem, destino)];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export interface LinhaInterna {
  uf: string;
  aliquota: number;
  fcp: number;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  fonte: string | null;
  observacao: string | null;
  updated_at?: string | null;
}

export interface LinhaInterestadual {
  uf_origem: string;
  uf_destino: string;
  aliquota: number;
  aliquota_importado: number;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  fonte: string | null;
  updated_at?: string | null;
}

/** Mantém apenas a linha vigente na data informada (a mais recente já iniciada). */
function vigente<T extends { vigencia_inicio: string; vigencia_fim: string | null }>(
  linhas: T[],
  data: string,
  chave: (l: T) => string,
): Map<string, T> {
  const mapa = new Map<string, T>();
  for (const l of linhas) {
    if (l.vigencia_inicio > data) continue;
    if (l.vigencia_fim && l.vigencia_fim < data) continue;
    const k = chave(l);
    const atual = mapa.get(k);
    if (!atual || l.vigencia_inicio > atual.vigencia_inicio) mapa.set(k, l);
  }
  return mapa;
}

/** Monta o snapshot a partir das linhas do banco, respeitando a vigência. */
export function montarTabela(
  internas: LinhaInterna[],
  interestaduais: LinhaInterestadual[],
  data = new Date().toISOString().slice(0, 10),
): TabelaAliquotas {
  const tabela = tabelaVazia();
  tabela.capturadaEm = new Date().toISOString();

  const marcarVigencia = (inicio: string, atualizado: string | null | undefined) => {
    if (inicio && (!tabela.vigenciaMaisRecente || inicio > tabela.vigenciaMaisRecente)) {
      tabela.vigenciaMaisRecente = inicio;
    }
    if (atualizado && (!tabela.atualizadaEm || atualizado > tabela.atualizadaEm)) {
      tabela.atualizadaEm = atualizado;
    }
  };

  for (const [uf, linha] of vigente(internas ?? [], data, (l) => l.uf.toUpperCase())) {
    tabela.internas[uf] = Number(linha.aliquota);
    tabela.detalhesInternas[uf] = {
      aliquota: Number(linha.aliquota),
      fcp: Number(linha.fcp ?? 0),
      vigenciaInicio: linha.vigencia_inicio,
      vigenciaFim: linha.vigencia_fim,
      fonte: linha.fonte,
      observacao: linha.observacao,
      atualizadaEm: linha.updated_at ?? null,
    };
    marcarVigencia(linha.vigencia_inicio, linha.updated_at);
  }
  for (const [par, linha] of vigente(interestaduais ?? [], data, (l) =>
    chavePar(l.uf_origem, l.uf_destino),
  )) {
    tabela.interestaduais[par] = Number(linha.aliquota);
    tabela.importadas[par] = Number(linha.aliquota_importado);
    tabela.detalhesInterestaduais[par] = {
      aliquota: Number(linha.aliquota),
      aliquotaImportado: Number(linha.aliquota_importado),
      vigenciaInicio: linha.vigencia_inicio,
      vigenciaFim: linha.vigencia_fim,
      fonte: linha.fonte,
      atualizadaEm: linha.updated_at ?? null,
    };
    marcarVigencia(linha.vigencia_inicio, linha.updated_at);
  }
  return tabela;
}

/**
 * Preenche a operação com as alíquotas vigentes do snapshot.
 * Não sobrescreve ajustes manuais quando `manterManuais` é verdadeiro.
 */
export function sincronizarOperacao(
  op: import("@/types/pricing").OperacaoFiscal,
  tabela: TabelaAliquotas | null,
): import("@/types/pricing").OperacaoFiscal {
  const interna = aliquotaInterna(tabela, op.ufDestino);
  const inter = aliquotaInterestadual(tabela, op.ufOrigem, op.ufDestino, op.importada);
  return { ...op, aliquotaInternaDestino: interna, aliquotaInterestadual: inter };
}

/** Metadados da alíquota interna vigente do estado informado. */
export function detalheInterna(tabela: TabelaAliquotas | null, uf: string): DetalheAliquota | null {
  if (!tabela) return null;
  return tabela.detalhesInternas[(uf ?? "").toUpperCase()] ?? null;
}

/** Metadados da alíquota interestadual vigente do par informado. */
export function detalheInterestadual(
  tabela: TabelaAliquotas | null,
  origem: string,
  destino: string,
): DetalheAliquota | null {
  if (!tabela) return null;
  return tabela.detalhesInterestaduais[chavePar(origem, destino)] ?? null;
}

export type SituacaoBase = "vazia" | "vigente" | "desatualizada";

export interface StatusBase {
  situacao: SituacaoBase;
  /** Início de vigência mais recente encontrado. */
  vigencia: string | null;
  atualizadaEm: string | null;
  /** Dias desde a última alteração registrada. */
  diasDesdeAtualizacao: number | null;
  mensagem: string;
}

/**
 * Status da base de alíquotas: informa a vigência carregada e sinaliza quando
 * ela está antiga o bastante para merecer revisão (mais de 365 dias).
 */
export function statusBase(tabela: TabelaAliquotas | null, agora: Date = new Date()): StatusBase {
  const vazio: StatusBase = {
    situacao: "vazia",
    vigencia: null,
    atualizadaEm: null,
    diasDesdeAtualizacao: null,
    mensagem: "Base de alíquotas não carregada.",
  };
  if (!tabela || Object.keys(tabela.internas).length === 0) return vazio;

  const referencia = tabela.atualizadaEm ?? tabela.vigenciaMaisRecente;
  const dias = referencia
    ? Math.max(0, Math.floor((agora.getTime() - new Date(referencia).getTime()) / 86_400_000))
    : null;
  const desatualizada = dias !== null && dias > 365;

  return {
    situacao: desatualizada ? "desatualizada" : "vigente",
    vigencia: tabela.vigenciaMaisRecente,
    atualizadaEm: tabela.atualizadaEm,
    diasDesdeAtualizacao: dias,
    mensagem: desatualizada
      ? "A base de alíquotas não é revisada há mais de um ano. Confirme com o Administrador Geral."
      : "Base de alíquotas vigente.",
  };
}
