import { metaPagina } from "@/lib/seo-head";
import { createFileRoute } from "@tanstack/react-router";

import { PainelConvites } from "@/components/admin/PainelConvites";
import { ExigePapel } from "@/components/app/GuardaAcesso";

const TITULO = "Convites — Administração Precifica Grancont";
const DESCRICAO = "Convide novos usuários, reenvie links de ativação e cancele convites pendentes.";

export const Route = createFileRoute("/_authenticated/admin/convites")({
  head: () => ({
    ...metaPagina({
      titulo: TITULO,
      descricao: DESCRICAO,
      caminho: "/admin/convites",
    }),
  }),
  component: () => (
    <ExigePapel papel="super_admin">
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Convites</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            O cadastro público está desativado: o acesso só existe por convite.
          </p>
        </header>
        <PainelConvites escopoOrgId={null} />
      </main>
    </ExigePapel>
  ),
});
