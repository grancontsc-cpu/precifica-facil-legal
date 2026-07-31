// Deriva as rotas públicas indexáveis a partir dos arquivos de rota do projeto.
// Nada aqui é hardcode de conteúdo: a lista acompanha os arquivos em src/routes.

export interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const PREFIXO = "/src/routes/";

/**
 * Rotas que existem publicamente, mas não devem ser indexadas:
 * páginas de estado, redirecionamentos legados e telas de fluxo interno.
 */
const NAO_INDEXAVEIS = new Set([
  "/aceitar-convite",
  "/acesso-bloqueado",
  "/acesso-negado",
  "/aguardando-aprovacao",
  "/app",
  "/auth",
  "/cadastrar",
  "/confirmar-email",
  "/entrando",
  "/esqueci-minha-senha",
  "/licenca-suspensa",
  "/onboarding",
  "/redefinir-senha",
  "/teste-expirado",
]);

/** Peso e frequência por rota; o restante recebe o padrão. */
const AJUSTES: Record<string, Omit<SitemapEntry, "path">> = {
  "/": { changefreq: "weekly", priority: "1.0" },
  "/login": { changefreq: "monthly", priority: "0.8" },
  "/cadastro": { changefreq: "monthly", priority: "0.8" },
  "/recuperar-senha": { changefreq: "yearly", priority: "0.3" },
};

const PADRAO: Omit<SitemapEntry, "path"> = { changefreq: "monthly", priority: "0.5" };

/** Converte o caminho de arquivo de rota em caminho de URL, ou null se não for indexável. */
export function caminhoDaRota(arquivo: string): string | null {
  if (!arquivo.startsWith(PREFIXO)) return null;

  const semExtensao = arquivo.slice(PREFIXO.length).replace(/\.(tsx|ts|jsx|js)$/, "");

  // Rotas de layout/privadas, raiz, catch-all, parâmetros dinâmicos e endpoints.
  if (semExtensao.startsWith("__")) return null;
  if (semExtensao.startsWith("_") || semExtensao.includes("/_") || semExtensao.includes("._")) return null;
  if (semExtensao.includes("$")) return null;
  if (semExtensao.includes("[")) return null;
  if (semExtensao.startsWith("api/") || semExtensao.startsWith("api.")) return null;
  if (semExtensao === "route" || semExtensao.endsWith("/route") || semExtensao.endsWith(".route")) return null;

  const segmentos = semExtensao.split(/[./]/).filter(Boolean);
  if (segmentos[segmentos.length - 1] === "index") segmentos.pop();

  const caminho = `/${segmentos.join("/")}`;
  return caminho === "/" ? "/" : caminho.replace(/\/+$/, "");
}

/** Lista ordenada das entradas indexáveis do sitemap. */
export function entradasDoSitemap(arquivos: string[]): SitemapEntry[] {
  const caminhos = new Set<string>();

  for (const arquivo of arquivos) {
    const caminho = caminhoDaRota(arquivo);
    if (!caminho) continue;
    if (NAO_INDEXAVEIS.has(caminho)) continue;
    caminhos.add(caminho);
  }

  return [...caminhos]
    .sort((a, b) => (a === "/" ? -1 : b === "/" ? 1 : a.localeCompare(b, "pt-BR")))
    .map((path) => ({ path, ...(AJUSTES[path] ?? PADRAO) }));
}

/** Monta o XML do sitemap para as entradas informadas. */
export function montarSitemapXml(baseUrl: string, entradas: SitemapEntry[]): string {
  const urls = entradas.map((e) =>
    [
      `  <url>`,
      `    <loc>${baseUrl}${e.path}</loc>`,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}
