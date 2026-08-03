import { metaPagina } from "@/lib/seo-head";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { Carregando } from "@/components/app/GuardaAcesso";
import { supabase } from "@/integrations/supabase/client";
import { provisionarConta } from "@/lib/conta.functions";
import { processarExpiracoes } from "@/lib/licencas.functions";
import { avaliarLicenca, rotaBloqueio, type Licenca } from "@/lib/licencas";

export const Route = createFileRoute("/entrando")({
  head: () => ({
    ...metaPagina({
      titulo: "Entrando — Precifica Grancont",
      descricao: "Verificando sua conta e liberando o acesso ao Precifica Grancont.",
      caminho: "/entrando",
    }),
  }),
  ssr: false,
  component: Entrando,
});

function Entrando() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const { data: sessao } = await supabase.auth.getUser();
      const user = sessao.user;
      if (!user) {
        navigate({ to: "/login", replace: true });
        return;
      }

      try {
        await provisionarConta();
        // Bloqueio automático: encerra testes e licenças vencidas antes de decidir o destino.
        await processarExpiracoes();
      } catch {
        /* provisionamento tolerante a falha: o guarda de acesso decide o destino */
      }

      const [{ data: perfil }, { data: globais }, { data: vinculos }, { data: pedidoPendente }] = await Promise.all([
        supabase.from("profiles").select("account_status").eq("id", user.id).maybeSingle(),
        supabase.from("global_user_roles").select("role").eq("user_id", user.id),
        supabase
          .from("organization_members")
          .select("role")
          .eq("user_id", user.id)
          .eq("membership_status", "active"),
        supabase
          .from("organization_join_requests")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "pending")
          .maybeSingle(),
      ]);

      const { data: licenca } = await supabase
        .from("licenses")
        .select("status, plan, trial_started_at, trial_ends_at, activated_at, expires_at, notes")
        .eq("user_id", user.id)
        .maybeSingle();

      await supabase.from("profiles").update({ last_access_at: new Date().toISOString() }).eq("id", user.id);

      if (cancelado) return;

      const status = perfil?.account_status ?? "pending_email_verification";
      const superAdmin = (globais ?? []).some((g) => g.role === "super_admin");
      const gestor = (vinculos ?? []).some((v) => v.role === "manager");

      const situacao = avaliarLicenca((licenca as Licenca | null) ?? null);

      const destino =
        status === "active" && !superAdmin && !situacao.liberado
          ? rotaBloqueio(situacao)
          : status === "suspended"
          ? "/licenca-suspensa"
          : status === "pending_approval"
            ? "/aguardando-aprovacao"
            : status === "pending_email_verification" || status === "invited"
              ? "/confirmar-email"
              : status !== "active"
                ? "/acesso-negado"
                : superAdmin
                  ? "/admin"
                  : (vinculos ?? []).length === 0
                    ? (pedidoPendente ? "/aguardando-aprovacao" : "/onboarding")
                    : gestor
                      ? "/gestao"
                      : "/simulador";

      navigate({ to: destino, replace: true });
    })();
    return () => {
      cancelado = true;
    };
  }, [navigate]);

  return (
    <main className="min-h-screen bg-background">
      <Carregando marca texto="Verificando seu acesso…" />
    </main>
  );
}
