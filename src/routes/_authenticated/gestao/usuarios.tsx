import { createFileRoute } from "@tanstack/react-router";

import { PainelUsuarios } from "@/components/admin/PainelUsuarios";
import { ExigePapel } from "@/components/app/GuardaAcesso";
import { useApp } from "@/hooks/useApp";

const TITULO = "Usuários da empresa — Precifica Grancont";
const DESCRICAO = "Gestor: acompanhe a equipe da empresa, suspenda acessos e redefina senhas no Precifica Grancont.";

export const Route = createFileRoute("/_authenticated/gestao/usuarios")({
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
  component: Pagina,
});

function Pagina() {
  const { orgId } = useApp();
  return (
    <ExigePapel papel="manager">
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Usuários da empresa</h1>
          <p className="mt-1 text-sm text-muted-foreground">Somente usuários vinculados à empresa selecionada.</p>
        </header>
        <PainelUsuarios escopoOrgId={orgId} />
      </main>
    </ExigePapel>
  );
}
