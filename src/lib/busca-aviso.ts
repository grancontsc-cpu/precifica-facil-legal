import { MAX_BUSCA, sanitizarBusca } from "@/lib/mcp/tools/filtro-busca";

export type AvaliacaoBusca = {
  /** Texto efetivamente usado no filtro (normalizado e limitado). */
  termo: string;
  /** O texto digitado passa de MAX_BUSCA caracteres. */
  excedeu: boolean;
  /** O texto digitado foi alterado pela normalização (fora o corte de tamanho). */
  normalizado: boolean;
  /** Mensagem em PT-BR explicando o ajuste, ou null quando nada mudou. */
  aviso: string | null;
};

/**
 * Avalia o texto digitado na busca e explica ao usuário, em português,
 * o que foi ajustado antes de montar o filtro.
 */
export function avaliarBusca(texto: string): AvaliacaoBusca {
  const original = texto ?? "";
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

  return { termo, excedeu, normalizado, aviso };
}

