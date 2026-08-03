/** Tamanho máximo aceito para o texto de busca já normalizado. */
export const MAX_BUSCA = 100;

/**
 * Normaliza e sanitiza texto de busca antes de montar filtros PostgREST (.or()).
 *
 * Etapas, nesta ordem:
 * 1. Normalização Unicode (NFKC) para evitar variantes visuais do mesmo caractere.
 * 2. Remoção de caracteres invisíveis (zero-width, hífen suave, BOM, word joiner).
 * 3. Remoção de caracteres de controle (inclui quebras de linha e tabulações).
 * 4. Remoção de caracteres com significado sintático no PostgREST
 *    (vírgula, ponto, parênteses, aspas, barra invertida) e dos curingas do LIKE.
 * 5. Colapso de espaços duplicados + trim.
 * 6. Corte em MAX_BUSCA caracteres, com novo trim para não deixar espaço final.
 */
export function sanitizarBusca(texto: unknown): string {
  if (typeof texto !== "string") return "";

  return texto
    .normalize("NFKC")
    .replace(/[\u00ad\u200b-\u200f\u2028\u2029\u2060\ufeff]/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[,.()"'\\%_*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_BUSCA)
    .trim();
}

/** Monta uma expressão .or() com ilike em várias colunas, já sanitizada. */
export function filtroIlike(colunas: string[], texto: unknown): string | null {
  const limpo = sanitizarBusca(texto);
  if (!limpo) return null;
  return colunas.map((coluna) => `${coluna}.ilike.%${limpo}%`).join(",");
}
