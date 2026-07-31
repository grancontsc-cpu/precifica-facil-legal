import { createFileRoute, Link } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { registrarEventoEmail } from "@/lib/email-eventos.functions";

const TITULO = "Confirme seu e-mail — Precifica Grancont";
const DESCRICAO = "Confirme seu endereço de e-mail para ativar o acesso ao Precifica Grancont.";

export const Route = createFileRoute("/confirmar-email")({
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
  ssr: false,
  component: Pagina,
});

function Pagina() {
  const reenviar = async () => {
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email) {
      toast.error("Faça login novamente para reenviar a confirmação.");
      return;
    }
    const { error } = await supabase.auth.resend({ type: "signup", email });
    void registrarEventoEmail({
      data: {
        tipo: "confirmacao_reenviada",
        email,
        status: error ? "erro" : "ok",
        codigoErro: error?.code ?? undefined,
        mensagemErro: error?.message ?? undefined,
      },
    }).catch(() => {});
    toast.success("Se a confirmação ainda estiver pendente, um novo link chegará em instantes.");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Toaster />
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
        <MailCheck className="mx-auto h-8 w-8 text-primary" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold text-foreground">Confirme seu e-mail</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enviamos um link de confirmação para o seu e-mail. Após confirmar, entre novamente para acessar o sistema.
        </p>
        <div className="mt-6 grid gap-2">
          <Button variant="outline" onClick={() => void reenviar()}>
            Reenviar e-mail de confirmação
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
          >
            Sair
          </Button>
        </div>
        <Link to="/login" className="mt-3 inline-block text-xs text-primary hover:underline">
          Voltar para o login
        </Link>
      </div>
    </main>
  );
}
