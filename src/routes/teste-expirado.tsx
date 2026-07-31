import { createFileRoute } from "@tanstack/react-router";

import { AvisoLicenca } from "@/components/app/AvisoLicenca";

const TITULO = "Teste gratuito encerrado — Precifica Grancont";
const DESCRICAO = "Seu período de teste gratuito de 30 dias terminou. Solicite a liberação da licença.";

export const Route = createFileRoute("/teste-expirado")({
  head: () => ({
    meta: [
      { title: TITULO },
      { name: "description", content: DESCRICAO },
      { property: "og:title", content: TITULO },
      { property: "og:description", content: DESCRICAO },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: () => (
    <AvisoLicenca variante="teste" titulo="Teste gratuito encerrado" descricao={DESCRICAO} />
  ),
});
