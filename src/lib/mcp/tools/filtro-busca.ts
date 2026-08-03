/**
 * Sanitiza texto de busca antes de montar filtros PostgREST (.or()).
 * Remove caracteres com significado sintático no PostgREST
 * (vírgula, ponto, parênteses, aspas, barra invertida) e curingas
 * do LIKE informados pelo usuário, evitando injeção de cláusulas.
 */
export function sanitizarBusca(texto: string): string {
  return texto
    .replace(/[,.()"'\\%_*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

/** Monta uma expressão .or() com ilike em várias colunas, já sanitizada. */
export function filtroIlike(colunas: string[], texto: string): string | null {
  const limpo = sanitizarBusca(texto);
  if (!limpo) return null;
  return colunas.map((coluna) => `${coluna}.ilike.%${limpo}%`).join(",");
}
