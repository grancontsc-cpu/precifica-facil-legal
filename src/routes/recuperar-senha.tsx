import { metaPagina } from "@/lib/seo-head";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { LogoGrancont } from "@/components/app/LogoGrancont";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { registrarEventoEmail } from "@/lib/email-eventos.functions";

const TITULO = "Recuperar senha — Precifica Grancont";
const DESCRICAO = "Solicite um link seguro para redefinir a senha do seu acesso ao Precifica Grancont.";

export const Route = createFileRoute("/recuperar-senha")({
  head: () => ({
    ...metaPagina({
      titulo: TITULO,
      descricao: DESCRICAO,
      caminho: "/recuperar-senha",
      indexavel: true,
    }),
  }),
  ssr: false,
  component: Pagina,
});

function Pagina() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailLimpo = email.trim().toLowerCase();
    setCarregando(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailLimpo, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });

      void registrarEventoEmail({
        data: {
          tipo: "recuperacao_solicitada",
          email: emailLimpo,
          status: error ? "erro" : "ok",
          codigoErro: error?.code ?? undefined,
          mensagemErro: error?.message ?? undefined,
        },
      }).catch(() => {});

      // Resposta genérica: nunca revelamos se existe conta com este e-mail.
      setEnviado(true);
      toast.success("Se houver uma conta com este e-mail, enviaremos o link de nova senha.");
    } catch {
      setEnviado(true);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <h1 className="text-lg font-semibold text-foreground">Recuperar senha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe seu e-mail para receber o link de criação de nova senha.
        </p>

        {enviado ? (
          <p className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            Se houver uma conta associada a <span className="font-medium text-foreground">{email}</span>, o link de nova
            senha chegará em instantes. Verifique a caixa de entrada e também o spam — o link vale por tempo limitado.
          </p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={enviar}>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={carregando}>
              {carregando ? "Enviando…" : "Enviar instruções"}
            </Button>
          </form>
        )}

        <Link to="/login" className="mt-4 inline-block text-xs text-primary hover:underline">
          Voltar para o login
        </Link>
      </div>
    </main>
  );
}
