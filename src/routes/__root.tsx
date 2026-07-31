import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { TemaProvider } from "../hooks/useTema";
import { SITE_NOME, SITE_URL } from "../lib/seo-head";
import { GA_MEASUREMENT_ID, registrarPageView } from "../lib/analytics";


const TITULO_PADRAO = "Precifica Grancont — precificação tributária para empresas";
const DESCRICAO_PADRAO =
  "Simulador de precificação: custo líquido de aquisição, créditos tributários e preço de venda recomendado por regime e por estado.";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="num-destaque text-6xl font-bold text-primary/25">404</p>
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
          Página não encontrada
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço acessado não existe ou foi movido para outro lugar.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-xs)] transition-colors hover:bg-primary/90"
          >
            Voltar para o simulador
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Não conseguimos abrir esta tela
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nenhum dado da sua simulação foi perdido. Tente novamente ou volte ao início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-xs)] transition-colors hover:bg-primary/90"
          >
            Tentar de novo
          </button>
          <a
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-input bg-card px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: TITULO_PADRAO },
      { name: "description", content: DESCRICAO_PADRAO },
      { name: "author", content: "Grancont" },
      { name: "google-site-verification", content: "ubZZVcdFG3gdMEA9ccegfi4H9YGjYXxiy71bmcYPplI" },
      { name: "theme-color", content: "#1e1b4b" },

      // Defaults sitewide. Cada rota folha sobrescreve título, descrição e og:*
      // (o TanStack deduplica meta por name/property).
      { property: "og:site_name", content: SITE_NOME },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: TITULO_PADRAO },
      { property: "og:description", content: DESCRICAO_PADRAO },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITULO_PADRAO },
      { name: "twitter:description", content: DESCRICAO_PADRAO },
    ],
    scripts: [
      // O Google Analytics NÃO é carregado aqui: a tag só é injetada após o
      // consentimento explícito do usuário (LGPD) — ver src/lib/consentimento.ts.
      {

        type: "application/ld+json",

        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: SITE_NOME,
          url: `${SITE_URL}/`,
          applicationCategory: "FinanceApplication",
          operatingSystem: "Web",
          inLanguage: "pt-BR",
          description: DESCRICAO_PADRAO,
          publisher: {
            "@type": "Organization",
            name: "Grancont",
            url: `${SITE_URL}/`,
          },
        }),
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // A tag do GA envia o page_view inicial; navegações SPA precisam de envio manual.
  useEffect(() => {
    let anterior = window.location.pathname + window.location.search;
    return router.subscribe("onResolved", () => {
      const atual = window.location.pathname + window.location.search;
      if (atual === anterior) return;
      anterior = atual;
      registrarPageView(atual);
    });
  }, [router]);



  return (
    <QueryClientProvider client={queryClient}>
      <TemaProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <Toaster />
      </TemaProvider>
    </QueryClientProvider>
  );
}
