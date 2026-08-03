import { metaPagina } from "@/lib/seo-head";
import { createFileRoute } from "@tanstack/react-router";

import { PainelUsuarios } from "@/components/admin/PainelUsuarios";
import { ExigePapel } from "@/components/app/GuardaAcesso";

const TITULO = "Usuários — Administração Precifica Grancont";
const DESCRICAO =
  "Gerencie usuários de todas as empresas: papéis, situação de conta, vínculos e redefinição de senha.";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  head: () => ({
    ...metaPagina({
      titulo: TITULO,
      descricao: DESCRICAO,
      caminho: "/admin/usuarios",
    }),
  }),
  component: () => (
    <ExigePapel papel="super_admin">
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Usuários</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todos os usuários vinculados às empresas atendidas.
          </p>
        </header>
        <PainelUsuarios escopoOrgId={null} />
      </main>
    </ExigePapel>
  ),
});
