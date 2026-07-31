import { useQuery } from "@tanstack/react-query";
import { metaPagina } from "@/lib/seo-head";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, MailPlus, Users } from "lucide-react";

import { ExigePapel } from "@/components/app/GuardaAcesso";
import { useApp } from "@/hooks/useApp";
import { supabase } from "@/integrations/supabase/client";

const TITULO = "Gestão da empresa — Precifica Grancont";
const DESCRICAO = "Painel do gestor: usuários da empresa, convites e simulações da equipe no Precifica Grancont.";

export const Route = createFileRoute("/_authenticated/gestao/")({
  head: () => ({
    ...metaPagina({
      titulo: TITULO,
      descricao: DESCRICAO,
      caminho: "/gestao",
    }),
  }),
  component: () => (
    <ExigePapel papel="manager">
      <PainelGestao />
    </ExigePapel>
  ),
});

function PainelGestao() {
  const { orgId, organizations } = useApp();
  const empresa = organizations.find((o) => o.id === orgId);

  const resumo = useQuery({
    queryKey: ["gestao", "resumo", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const [usuarios, convites, simulacoes] = await Promise.all([
        supabase
          .from("organization_members")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId!)
          .eq("membership_status", "active"),
        supabase
          .from("invitations")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId!)
          .eq("invitation_status", "pending"),
        supabase.from("simulations").select("id", { count: "exact", head: true }).eq("organization_id", orgId!),
      ]);
      return {
        usuarios: usuarios.count ?? 0,
        convites: convites.count ?? 0,
        simulacoes: simulacoes.count ?? 0,
      };
    },
  });

  const cards = [
    { rotulo: "Usuários da empresa", valor: resumo.data?.usuarios, icone: Users, para: "/gestao/usuarios" },
    { rotulo: "Convites pendentes", valor: resumo.data?.convites, icone: MailPlus, para: "/gestao/convites" },
    { rotulo: "Simulações da equipe", valor: resumo.data?.simulacoes, icone: ClipboardList, para: "/simulacoes" },
  ] as const;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Gestão da empresa</h1>
        <p className="mt-1 text-sm text-muted-foreground">{empresa?.name ?? "Selecione uma empresa no topo."}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c) => {
          const Icone = c.icone;
          return (
            <Link
              key={c.rotulo}
              to={c.para}
              className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icone className="h-4 w-4 text-primary" aria-hidden />
                {c.rotulo}
              </div>
              <p className="mt-2 text-2xl font-semibold text-foreground">{c.valor ?? "—"}</p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
