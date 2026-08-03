import { metaPagina } from "@/lib/seo-head";
import { createFileRoute } from "@tanstack/react-router";

import { PainelConvites } from "@/components/admin/PainelConvites";
import { ExigePapel } from "@/components/app/GuardaAcesso";
import { useApp } from "@/hooks/useApp";

const TITULO = "Convites da empresa — Precifica Grancont";
const DESCRICAO =
  "Gestor: convide novos usuários da sua empresa para o Precifica Grancont e acompanhe os convites.";

export const Route = createFileRoute("/_authenticated/gestao/convites")({
  head: () => ({
    ...metaPagina({
      titulo: TITULO,
      descricao: DESCRICAO,
      caminho: "/gestao/convites",
    }),
  }),
  component: Pagina,
});

function Pagina() {
  const { orgId } = useApp();
  return (
    <ExigePapel papel="manager">
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Convites da empresa
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestores convidam apenas usuários comuns; a promoção a gestor é feita pela Grancont.
          </p>
        </header>
        <PainelConvites escopoOrgId={orgId} />
      </main>
    </ExigePapel>
  );
}
