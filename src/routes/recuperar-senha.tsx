import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { DialogoCadastrar } from "@/components/app/DialogoCadastrar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { verificarEmailCadastrado } from "@/lib/conta.functions";

const TITULO = "Recuperar senha — Precifica Grancont";
const DESCRICAO = "Solicite um link seguro para redefinir a senha do seu acesso ao Precifica Grancont.";

export const Route = createFileRoute("/recuperar-senha")({
  head: () => ({
    meta: [
      { title: TITULO },
      { name: "description", content: DESCRICAO },
      { property: "og:title", content: TITULO },
      { property: "og:description", content: DESCRICAO },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  ssr: false,
  component: Pagina,
});

function Pagina() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [dialogo, setDialogo] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailLimpo = email.trim().toLowerCase();
    setCarregando(true);
    try {
      const { cadastrado } = await verificarEmailCadastrado({ data: { email: emailLimpo } });
      if (!cadastrado) {
        setDialogo(true);
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(emailLimpo, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (error) {
        toast.error("Não foi possível enviar agora. Tente novamente em alguns minutos.");
        return;
      }
      setEnviado(true);
      toast.success("Enviamos o link de nova senha para o seu e-mail.");
    } catch {
      toast.error("Não foi possível verificar o e-mail agora. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Toaster />
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <h1 className="text-lg font-semibold text-foreground">Recuperar senha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe seu e-mail para receber o link de criação de nova senha.
        </p>

        {enviado ? (
          <p className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            Link enviado para <span className="font-medium text-foreground">{email}</span>. Verifique sua caixa de
            entrada e também o spam. O link vale por tempo limitado.
          </p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={enviar}>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={carregando}>
              {carregando ? "Verificando…" : "Enviar instruções"}
            </Button>
          </form>
        )}

        <Link to="/login" className="mt-4 inline-block text-xs text-primary hover:underline">
          Voltar para o login
        </Link>
      </div>

      <DialogoCadastrar aberto={dialogo} email={email.trim().toLowerCase()} onFechar={() => setDialogo(false)} />
    </main>
  );
}
