/** Tamanho máximo aceito para o texto de busca já normalizado. */
export const MAX_BUSCA = 100;

/** Tamanho máximo aceito, em bytes UTF-8, para o texto bruto da busca. */
export const MAX_BYTES_BUSCA = 400;

/** Motivo pelo qual um texto de busca foi bloqueado antes de virar filtro. */
export type MotivoBloqueioBusca = "tipo" | "bytes" | "encoding";

export type ValidacaoBusca =
  | { valida: true; texto: string }
  | { valida: false; motivo: MotivoBloqueioBusca };

const CODIFICADOR = new TextEncoder();

/** Conta os bytes UTF-8 do texto (caracteres inválidos viram 3 bytes de U+FFFD). */
export function bytesBusca(texto: string): number {
  return CODIFICADOR.encode(texto).length;
}

/**
 * Rejeita entradas antes de qualquer normalização:
 * - tipo diferente de string;
 * - byte-length excessivo (evita payloads gigantes em UTF-8 multibyte);
 * - encoding inválido (surrogates soltos ou caractere de substituição U+FFFD).
 */
export function validarBusca(texto: unknown): ValidacaoBusca {
  if (typeof texto !== "string") return { valida: false, motivo: "tipo" };

  // Surrogate solto (par UTF-16 quebrado) ou marcador de decodificação inválida.
  if (
    /\ufffd/.test(texto) ||
    /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(texto)
  ) {
    return { valida: false, motivo: "encoding" };
  }

  if (bytesBusca(texto) > MAX_BYTES_BUSCA) {
    return { valida: false, motivo: "bytes" };
  }

  return { valida: true, texto };
}

/**
 * Normaliza e sanitiza texto de busca antes de montar filtros PostgREST (.or()).
 *
 * Etapas, nesta ordem:
 * 0. Validação prévia (tipo, byte-length e encoding) — entradas inválidas viram "".
 * 1. Normalização Unicode (NFKC) para evitar variantes visuais do mesmo caractere.
 * 2. Remoção de caracteres invisíveis (zero-width, hífen suave, BOM, word joiner).
 * 3. Remoção de caracteres de controle (inclui quebras de linha e tabulações).
 * 4. Remoção de caracteres com significado sintático no PostgREST
 *    (vírgula, ponto, parênteses, aspas, barra invertida) e dos curingas do LIKE.
 * 5. Colapso de espaços duplicados + trim.
 * 6. Corte em MAX_BUSCA caracteres, com novo trim para não deixar espaço final.
 */
export function sanitizarBusca(texto: unknown): string {
  const validacao = validarBusca(texto);
  if (!validacao.valida) return "";

  return (
    validacao.texto
      .normalize("NFKC")
      .replace(/[\u00ad\u200b-\u200f\u2028\u2029\u2060\ufeff]/g, "")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/[,.()"'\\%_*]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_BUSCA)
      .trim()
  );
}

/** Monta uma expressão .or() com ilike em várias colunas, já sanitizada. */
export function filtroIlike(colunas: string[], texto: unknown): string | null {
  const limpo = sanitizarBusca(texto);
  if (!limpo) return null;
  return colunas.map((coluna) => `${coluna}.ilike.%${limpo}%`).join(",");
}
