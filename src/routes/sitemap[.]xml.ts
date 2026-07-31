import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { entradasDoSitemap, montarSitemapXml } from "@/lib/sitemap";

const BASE_URL = "https://precifica-facil-legal.lovable.app";

// Lista os arquivos de rota em tempo de build (sem importar os módulos),
// para o sitemap acompanhar automaticamente as páginas públicas do app.
const ARQUIVOS_DE_ROTA = Object.keys(
  import.meta.glob("/src/routes/**/*.{ts,tsx}", { eager: false }),
);

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const xml = montarSitemapXml(BASE_URL, entradasDoSitemap(ARQUIVOS_DE_ROTA));

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
