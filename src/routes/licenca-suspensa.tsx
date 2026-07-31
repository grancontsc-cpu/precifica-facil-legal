import { metaPagina } from "@/lib/seo-head";
import { createFileRoute } from "@tanstack/react-router";

import { AvisoLicenca } from "@/components/app/AvisoLicenca";

const TITULO = "Licença suspensa — Precifica Grancont";
const DESCRICAO =
  "O acesso da sua conta ao Precifica Grancont está suspenso. Solicite a reativação ao Administrador Grancont.";

export const Route = createFileRoute("/licenca-suspensa")({
  head: () => ({
    ...metaPagina({
      titulo: TITULO,
      descricao: DESCRICAO,
      caminho: "/licenca-suspensa",
    }),
  }),
  ssr: false,
  component: () => (
    <AvisoLicenca variante="licenca" titulo="Acesso suspenso" descricao={DESCRICAO} />
  ),
});
