import { createFileRoute } from "@tanstack/react-router";

import { AvisoLicenca } from "@/components/app/AvisoLicenca";

const TITULO = "Licença suspensa — Precifica Grancont";
const DESCRICAO =
  "O acesso da sua conta ao Precifica Grancont está suspenso. Solicite a reativação ao Administrador Grancont.";

export const Route = createFileRoute("/licenca-suspensa")({
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
    <AvisoLicenca variante="licenca" titulo="Acesso suspenso" descricao={DESCRICAO} />
  ),
});
