import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

const TITULO = "Redefinir senha — Precifica Grancont";
const DESCRICAO = "Crie uma nova senha para o seu acesso ao Precifica Grancont.";

export const Route = createFileRoute("/redefinir-senha")({
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
  const navigate = useNavigate();
  const [pronto, setPronto] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setPronto(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setPronto(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha.length < 8) {
      toast.error("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      toast.error("As senhas não conferem.");
      return;
    }
    setCarregando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setCarregando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha atualizada.");
    navigate({ to: "/entrando", replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Toaster />
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <h1 className="text-lg font-semibold text-foreground">Criar nova senha</h1>
        {!pronto ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Abra esta página pelo link enviado no e-mail de recuperação. O link é válido por tempo limitado.
          </p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={salvar}>
            <div className="space-y-1.5">
              <Label htmlFor="s1">Nova senha</Label>
              <Input id="s1" type="password" minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s2">Confirmar nova senha</Label>
              <Input
                id="s2"
                type="password"
                minLength={8}
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={carregando}>
              Salvar nova senha
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
