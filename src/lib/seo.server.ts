// Acesso server-only ao Google Search Console via gateway de conectores.
// Nunca importe este arquivo de componentes ou rotas de UI.

const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";

export const SITE_URL = "https://precifica-facil-legal.lovable.app";
export const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;

export interface StatusSitemap {
  propriedade: string;
  sitemap: string;
  ultimoEnvio: string | null;
  ultimaLeitura: string | null;
  pendente: boolean;
  avisos: number;
  erros: number;
  urlsEnviadas: number;
  urlsIndexadas: number;
}

function cabecalhos() {
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  const connectionApiKey = process.env["GOOGLE_SEARCH_CONSOLE_API_KEY"];
  if (!lovableApiKey || !connectionApiKey) {
    throw new Error("Conexão com o Google Search Console indisponível neste ambiente.");
  }
  return {
    Authorization: `Bearer ${lovableApiKey}`,
    "X-Connection-Api-Key": connectionApiKey,
  };
}

function cobreODominio(siteUrl: string, alvo: URL) {
  if (siteUrl.startsWith("sc-domain:")) {
    const dominio = siteUrl.slice("sc-domain:".length).toLowerCase();
    const host = alvo.hostname.toLowerCase();
    return host === dominio || host.endsWith(`.${dominio}`);
  }
  try {
    return alvo.href.startsWith(new URL(siteUrl).href);
  } catch {
    return false;
  }
}

/** Resolve a propriedade verificada que cobre o site — nunca fixada em código. */
export async function resolverPropriedade(): Promise<string> {
  const resposta = await fetch(`${GATEWAY}/webmasters/v3/sites`, { headers: cabecalhos() });
  if (!resposta.ok) {
    throw new Error(`Não foi possível listar as propriedades [${resposta.status}]: ${await resposta.text()}`);
  }

  const { siteEntry = [] } = (await resposta.json()) as {
    siteEntry?: { siteUrl: string; permissionLevel?: string }[];
  };

  const alvo = new URL(SITE_URL);
  const candidatas = siteEntry.filter(
    (e) => e.permissionLevel !== "siteUnverifiedUser" && cobreODominio(e.siteUrl, alvo),
  );

  if (candidatas.length === 0) {
    throw new Error("Nenhuma propriedade verificada do Search Console cobre este site.");
  }
  // Com uma única propriedade verificada por domínio, a escolha é determinística.
  return candidatas[0].siteUrl;
}

/** Reenvia o sitemap ao Google e devolve o status atualizado. */
export async function submeterSitemap(): Promise<StatusSitemap> {
  const propriedade = await resolverPropriedade();
  const caminho = `${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(propriedade)}/sitemaps/${encodeURIComponent(SITEMAP_URL)}`;

  const envio = await fetch(caminho, { method: "PUT", headers: cabecalhos() });
  if (!envio.ok) {
    throw new Error(`O Google recusou o envio do sitemap [${envio.status}]: ${await envio.text()}`);
  }

  return consultarStatus(propriedade);
}

/** Lê o status atual do sitemap na propriedade verificada. */
export async function consultarStatus(propriedadeConhecida?: string): Promise<StatusSitemap> {
  const propriedade = propriedadeConhecida ?? (await resolverPropriedade());
  const resposta = await fetch(
    `${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(propriedade)}/sitemaps`,
    { headers: cabecalhos() },
  );
  if (!resposta.ok) {
    throw new Error(`Não foi possível ler o status do sitemap [${resposta.status}]: ${await resposta.text()}`);
  }

  const { sitemap = [] } = (await resposta.json()) as {
    sitemap?: {
      path: string;
      lastSubmitted?: string;
      lastDownloaded?: string;
      isPending?: boolean;
      warnings?: string;
      errors?: string;
      contents?: { submitted?: string; indexed?: string }[];
    }[];
  };

  const atual = sitemap.find((s) => s.path === SITEMAP_URL) ?? sitemap[0];
  const conteudo = atual?.contents?.[0];

  return {
    propriedade,
    sitemap: atual?.path ?? SITEMAP_URL,
    ultimoEnvio: atual?.lastSubmitted ?? null,
    ultimaLeitura: atual?.lastDownloaded ?? null,
    pendente: Boolean(atual?.isPending),
    avisos: Number(atual?.warnings ?? 0),
    erros: Number(atual?.errors ?? 0),
    urlsEnviadas: Number(conteudo?.submitted ?? 0),
    urlsIndexadas: Number(conteudo?.indexed ?? 0),
  };
}
