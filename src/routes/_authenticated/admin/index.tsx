import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, ClipboardList, MailPlus, ShieldQuestion, Users } from "lucide-react";

import { ExigePapel } from "@/components/app/GuardaAcesso";
import { supabase } from "@/integrations/supabase/client";

const TITULO = "Administração geral — Precifica Grancont";
const DESCRICAO =
  "Painel do administrador geral do Precifica Grancont: empresas, usuários, convites, perfis tributários e auditoria.";

export const Route = createFileRoute("/_authenticated/admin/")({
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
  component: () => (
    <ExigePapel papel="super_admin">
      <PainelAdmin />
    </ExigePapel>
  ),
});

function PainelAdmin() {
  const resumo = useQuery({
    queryKey: ["admin", "resumo"],
    queryFn: async () => {
      const [empresas, usuarios, convites, simulacoes, solicitacoes] = await Promise.all([
        supabase.from("organizations").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("account_status", "active"),
        supabase.from("invitations").select("id", { count: "exact", head: true }).eq("invitation_status", "pending"),
        supabase.from("simulations").select("id", { count: "exact", head: true }),
        supabase
          .from("access_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .is("simulation_id", null),
      ]);
      return {
        empresas: empresas.count ?? 0,
        usuarios: usuarios.count ?? 0,
        convites: convites.count ?? 0,
        simulacoes: simulacoes.count ?? 0,
        solicitacoes: solicitacoes.count ?? 0,
      };
    },
  });

  const cards = [
    { rotulo: "Empresas ativas", valor: resumo.data?.empresas, icone: Building2, para: "/admin/empresas" },
    { rotulo: "Usuários ativos", valor: resumo.data?.usuarios, icone: Users, para: "/admin/usuarios" },
    { rotulo: "Convites pendentes", valor: resumo.data?.convites, icone: MailPlus, para: "/admin/convites" },
    { rotulo: "Simulações registradas", valor: resumo.data?.simulacoes, icone: ClipboardList, para: "/simulacoes" },
    {
      rotulo: "Solicitações de acesso",
      valor: resumo.data?.solicitacoes,
      icone: ShieldQuestion,
      para: "/admin/solicitacoes",
    },
  ] as const;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Administração geral</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão consolidada de todas as empresas atendidas pela Grancont.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

      <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { to: "/admin/empresas", t: "Empresas", d: "Cadastrar clientes e definir padrões." },
          { to: "/admin/usuarios", t: "Usuários", d: "Papéis, situação e vínculos." },
          { to: "/admin/convites", t: "Convites", d: "Convidar, reenviar e cancelar." },
          { to: "/admin/perfis-tributarios", t: "Perfis tributários", d: "Versões e campos bloqueados." },
          { to: "/admin/simulacoes", t: "Simulações", d: "Histórico de todas as empresas." },
          { to: "/admin/solicitacoes", t: "Solicitações de acesso", d: "Pedidos de acesso administrativo." },
          { to: "/admin/auditoria", t: "Auditoria", d: "Registro completo de ações." },
        ].map((i) => (
          <Link key={i.to} to={i.to} className="rounded-lg border border-border bg-card p-4 hover:border-primary/40">
            <p className="text-sm font-medium text-foreground">{i.t}</p>
            <p className="mt-1 text-xs text-muted-foreground">{i.d}</p>
          </Link>
        ))}
      </nav>
    </main>
  );
}
