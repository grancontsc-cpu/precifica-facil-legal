import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ForcaSenha } from "@/components/app/ForcaSenha";
import { registrarEventoEmail } from "@/lib/email-eventos.functions";
import { mensagemSenhaInvalida, traduzirErroSenha } from "@/lib/senha";

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
    const problema = mensagemSenhaInvalida(senha);
    if (problema) {
      toast.error(problema);
      return;
    }
    if (senha !== confirmacao) {
      toast.error("As senhas não conferem.");
      return;
    }
    setCarregando(true);
    const { data: sessao } = await supabase.auth.getUser();
    const { error } = await supabase.auth.updateUser({ password: senha });
    setCarregando(false);

    void registrarEventoEmail({
      data: {
        tipo: "senha_redefinida",
        email: sessao.user?.email ?? undefined,
        status: error ? "erro" : "ok",
        codigoErro: error?.code ?? undefined,
        mensagemErro: error?.message ?? undefined,
      },
    }).catch(() => {});

    if (error) {
      toast.error(
        traduzirErroSenha(error.message) ??
          "Não conseguimos salvar a nova senha. Peça um novo link e tente novamente.",
      );
      return;
    }
    toast.success("Senha atualizada.");
    navigate({ to: "/entrando", replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
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
              <Input
                id="s1"
                type="password"
                minLength={8}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                aria-describedby="forca-senha-nova"
                required
              />
              <ForcaSenha senha={senha} id="forca-senha-nova" className="pt-1" />
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
