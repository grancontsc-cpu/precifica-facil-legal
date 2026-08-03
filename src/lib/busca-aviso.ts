import {
  MAX_BUSCA,
  MAX_BYTES_BUSCA,
  sanitizarBusca,
  validarBusca,
  type MotivoBloqueioBusca,
} from "@/lib/mcp/tools/filtro-busca";

export type AvaliacaoBusca = {
  /** Texto efetivamente usado no filtro (normalizado e limitado). */
  termo: string;
  /** O texto digitado passa de MAX_BUSCA caracteres. */
  excedeu: boolean;
  /** O texto digitado foi alterado pela normalização (fora o corte de tamanho). */
  normalizado: boolean;
  /** O texto foi rejeitado antes de virar filtro (byte-length ou encoding). */
  bloqueado: boolean;
  /** Motivo do bloqueio, quando houver. */
  motivo: MotivoBloqueioBusca | null;
  /** Mensagem em PT-BR explicando o ajuste, ou null quando nada mudou. */
  aviso: string | null;
};

/**
 * Avalia o texto digitado na busca e explica ao usuário, em português,
 * o que foi ajustado (ou bloqueado) antes de montar o filtro.
 */
export function avaliarBusca(texto: string): AvaliacaoBusca {
  const original = texto ?? "";
  const validacao = validarBusca(original);

  if (!validacao.valida) {
    const aviso =
      validacao.motivo === "bytes"
        ? `A busca é grande demais (limite de ${MAX_BYTES_BUSCA} bytes). ` +
          "Use poucas palavras-chave; acentos e emojis ocupam mais de um byte."
        : "Não foi possível ler o texto da busca: há caracteres com codificação inválida. " +
          "Apague o termo e digite novamente.";

    return {
      termo: "",
      excedeu: false,
      normalizado: false,
      bloqueado: true,
      motivo: validacao.motivo,
      aviso,
    };
  }

  const termo = sanitizarBusca(original);
  const excedeu = original.trim().length > MAX_BUSCA;
  const normalizado = !excedeu && original.trim().length > 0 && original.trim() !== termo;

  let aviso: string | null = null;
  if (excedeu) {
    aviso =
      `A busca usa no máximo ${MAX_BUSCA} caracteres — o restante foi ignorado. ` +
      "Reduza o texto para poucas palavras-chave.";
  } else if (normalizado) {
    aviso =
      "Ajustamos o texto da busca: pontuação, símbolos (, . ( ) \" ' \\ % _ *) e espaços " +
      `repetidos são removidos. Buscando por: “${termo}”.`;
  }

  return { termo, excedeu, normalizado, bloqueado: false, motivo: null, aviso };
}
