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
  const semCorte = sanitizarBusca(original.slice(0, MAX_BUSCA * 4)).length;

  const excedeu = original.trim().length > MAX_BUSCA;
  const normalizado = !excedeu && original.trim() !== termo && original.trim().length > 0;

  let aviso: string | null = null;
  if (excedeu) {
    aviso =
      `A busca usa no máximo ${MAX_BUSCA} caracteres — o restante foi ignorado. ` +
      "Reduza o texto para poucas palavras-chave (nome, SKU ou NCM).";
  } else if (normalizado) {
    aviso =
      "Ajustamos o texto da busca: pontuação, símbolos (, . ( ) \" ' \\ % _ *) e espaços " +
      `repetidos são removidos. Buscando por: “${termo}”.`;
  }

  void semCorte;
  return { termo, excedeu, normalizado, aviso };
}
