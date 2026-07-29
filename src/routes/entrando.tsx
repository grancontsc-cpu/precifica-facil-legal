import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { Carregando } from "@/components/app/GuardaAcesso";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/entrando")({
  head: () => ({
    meta: [
      { title: "Entrando — Precifica Grancont" },
      { name: "description", content: "Verificando suas permissões no Precifica Grancont." },
      { property: "og:title", content: "Entrando — Precifica Grancont" },
      { property: "og:description", content: "Verificando suas permissões no Precifica Grancont." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
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

      const [{ data: perfil }, { data: globais }, { data: vinculos }] = await Promise.all([
        supabase.from("profiles").select("account_status").eq("id", user.id).maybeSingle(),
        supabase.from("global_user_roles").select("role").eq("user_id", user.id),
        supabase
          .from("organization_members")
          .select("role")
          .eq("user_id", user.id)
          .eq("membership_status", "active"),
      ]);

      await supabase.from("profiles").update({ last_access_at: new Date().toISOString() }).eq("id", user.id);

      if (cancelado) return;

      const status = perfil?.account_status ?? "pending_email_verification";
      const superAdmin = (globais ?? []).some((g) => g.role === "super_admin");
      const gestor = (vinculos ?? []).some((v) => v.role === "manager");

      const destino =
        status === "suspended"
          ? "/acesso-bloqueado"
          : status === "pending_approval"
            ? "/aguardando-aprovacao"
            : status === "pending_email_verification" || status === "invited"
              ? "/confirmar-email"
              : status !== "active"
                ? "/acesso-negado"
                : superAdmin
                  ? "/admin"
                  : (vinculos ?? []).length === 0
                    ? "/acesso-negado"
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
      <Carregando texto="Verificando seu acesso…" />
    </main>
  );
}
