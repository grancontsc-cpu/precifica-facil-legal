/**
 * Padrão único de metatags de SEO e compartilhamento.
 *
 * Todas as rotas usam `metaPagina()` para que título, descrição, Open Graph,
 * Twitter, canonical e robots fiquem sempre coerentes entre si.
 */

export const SITE_URL = "https://precifica-facil-legal.lovable.app";
export const SITE_NOME = "Precifica Grancont";

export interface MetaPaginaOpcoes {
  /** Título completo da página (já com o sufixo da marca, quando fizer sentido). */
  titulo: string;
  /** Resumo em português, idealmente abaixo de 160 caracteres. */
  descricao: string;
  /** Caminho da rota, começando com "/". Usado em canonical e og:url. */
  caminho: string;
  /** Falso em telas de fluxo, estado ou área logada. Padrão: falso. */
  indexavel?: boolean;
  /** Cartão grande do Twitter/X. Padrão: apenas nas páginas indexáveis. */
  cartaoGrande?: boolean;
}

export interface HeadPagina {
  meta: Array<Record<string, string>>;
  links: Array<Record<string, string>>;
}

/** Normaliza o caminho e devolve a URL absoluta e autorreferente da página. */
export function urlCanonica(caminho: string): string {
  if (!caminho || caminho === "/") return `${SITE_URL}/`;
  const limpo = `/${caminho.replace(/^\/+/, "").replace(/\/+$/, "")}`;
  return `${SITE_URL}${limpo}`;
}

/**
 * Monta `meta` e `links` de uma rota folha.
 *
 * O canonical só é emitido aqui (nunca no root), porque o TanStack Router
 * concatena `links` sem deduplicar.
 */
export function metaPagina({
  titulo,
  descricao,
  caminho,
  indexavel = false,
  cartaoGrande,
}: MetaPaginaOpcoes): HeadPagina {
  const url = urlCanonica(caminho);
  const cartao = (cartaoGrande ?? indexavel) ? "summary_large_image" : "summary";

  const meta: Array<Record<string, string>> = [
    { title: titulo },
    { name: "description", content: descricao },
    { property: "og:title", content: titulo },
    { property: "og:description", content: descricao },
    { property: "og:type", content: "website" },
    { property: "og:url", content: url },
    { name: "twitter:card", content: cartao },
    { name: "twitter:title", content: titulo },
    { name: "twitter:description", content: descricao },
  ];

  if (!indexavel) {
    meta.push({ name: "robots", content: "noindex, nofollow" });
    meta.push({ name: "googlebot", content: "noindex, nofollow" });
  }

  return {
    meta,
    links: indexavel ? [{ rel: "canonical", href: url }] : [],
  };
}
