import { metaPagina } from "@/lib/seo-head";
import { createFileRoute } from "@tanstack/react-router";

import { AvisoLicenca } from "@/components/app/AvisoLicenca";

const TITULO = "Teste gratuito encerrado — Precifica Grancont";
const DESCRICAO = "Seu período de teste gratuito de 30 dias terminou. Solicite a liberação da licença.";

export const Route = createFileRoute("/teste-expirado")({
  head: () => ({
    ...metaPagina({
      titulo: TITULO,
      descricao: DESCRICAO,
      caminho: "/teste-expirado",
    }),
  }),
  ssr: false,
  component: () => (
    <AvisoLicenca variante="teste" titulo="Teste gratuito encerrado" descricao={DESCRICAO} />
  ),
});
