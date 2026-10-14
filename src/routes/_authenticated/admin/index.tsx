import { useQuery } from "@tanstack/react-query";
import { metaPagina } from "@/lib/seo-head";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Building2,
  ClipboardList,
  KeyRound,
  MailPlus,
  ShieldQuestion,
  Users,
} from "lucide-react";

import { ExigePapel } from "@/components/app/GuardaAcesso";
import { supabase } from "@/integrations/supabase/client";

const TITULO = "Administração geral — Precifica Grancont";
const DESCRICAO =
  "Painel do administrador geral do Precifica Grancont: empresas, usuários, convites, perfis tributários e auditoria.";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    ...metaPagina({
      titulo: TITULO,
      descricao: DESCRICAO,
      caminho: "/admin",
    }),
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
      const agora = new Date().toISOString();
      const [empresas, usuarios, convites, simulacoes, solicitacoes, vencidas] = await Promise.all([
        supabase
          .from("organizations")
          .select("id", { count: "exact", head: true })
          .eq("active", true),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("account_status", "active"),
        supabase
          .from("invitations")
          .select("id", { count: "exact", head: true })
          .eq("invitation_status", "pending"),
        supabase.from("simulations").select("id", { count: "exact", head: true }),
        supabase
          .from("access_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .is("simulation_id", null),
        supabase
          .from("licenses")
          .select("id", { count: "exact", head: true })
          .not("user_id", "is", null)
          .or(
            `status.in.(trial_expired,expired,suspended),and(status.eq.trial,trial_ends_at.lte.${agora}),and(status.eq.active,expires_at.lte.${agora})`,
          ),
      ]);
      return {
        empresas: empresas.count ?? 0,
        usuarios: usuarios.count ?? 0,
        convites: convites.count ?? 0,
        simulacoes: simulacoes.count ?? 0,
        solicitacoes: solicitacoes.count ?? 0,
        vencidas: vencidas.count ?? 0,
      };
    },
  });

  const cards = [
    {
      rotulo: "Aguardando liberação",
      valor: resumo.data?.vencidas,
      icone: KeyRound,
      para: "/admin/licencas",
    },
    {
      rotulo: "Empresas ativas",
      valor: resumo.data?.empresas,
      icone: Building2,
      para: "/admin/empresas",
    },
    {
      rotulo: "Usuários ativos",
      valor: resumo.data?.usuarios,
      icone: Users,
      para: "/admin/usuarios",
    },
    {
      rotulo: "Convites pendentes",
      valor: resumo.data?.convites,
      icone: MailPlus,
      para: "/admin/convites",
    },
    {
      rotulo: "Simulações registradas",
      valor: resumo.data?.simulacoes,
      icone: ClipboardList,
      para: "/simulacoes",
    },
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
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Administração geral
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão consolidada de todas as empresas atendidas pela Grancont.
        </p>
      </header>

      {(resumo.data?.vencidas ?? 0) > 0 && (
        <Link
          to="/admin/licencas"
          className="flex items-center gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-foreground hover:border-amber-500"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <span>
            <strong>{resumo.data?.vencidas} pessoa(s)</strong> com teste ou licença vencida
            aguardando liberação. <span className="text-primary underline">Liberar agora →</span>
          </span>
        </Link>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
          { to: "/admin/licencas", t: "Licenças e testes", d: "Liberar e estender acessos." },
          { to: "/admin/empresas", t: "Empresas", d: "Cadastrar clientes e definir padrões." },
          { to: "/admin/usuarios", t: "Usuários", d: "Papéis, situação e vínculos." },
          { to: "/admin/convites", t: "Convites", d: "Convidar, reenviar e cancelar." },
          {
            to: "/admin/perfis-tributarios",
            t: "Perfis tributários",
            d: "Versões e campos bloqueados.",
          },
          { to: "/admin/simulacoes", t: "Simulações", d: "Histórico de todas as empresas." },
          {
            to: "/admin/solicitacoes",
            t: "Solicitações de acesso",
            d: "Pedidos de acesso administrativo.",
          },
          { to: "/admin/auditoria", t: "Auditoria", d: "Registro completo de ações." },
        ].map((i) => (
          <Link
            key={i.to}
            to={i.to}
            className="rounded-lg border border-border bg-card p-4 hover:border-primary/40"
          >
            <p className="text-sm font-medium text-foreground">{i.t}</p>
            <p className="mt-1 text-xs text-muted-foreground">{i.d}</p>
          </Link>
        ))}
      </nav>
    </main>
  );
}
