import { metaPagina } from "@/lib/seo-head";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { LogoGrancont } from "@/components/app/LogoGrancont";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CamposSenha } from "@/components/app/CamposSenha";
import { registrarEventoEmail } from "@/lib/email-eventos.functions";
import { traduzirErroSenha, validarParDeSenhas } from "@/lib/senha";


const TITULO = "Redefinir senha — Precifica Grancont";
const DESCRICAO = "Crie uma nova senha para o seu acesso ao Precifica Grancont.";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    ...metaPagina({
      titulo: TITULO,
      descricao: DESCRICAO,
      caminho: "/redefinir-senha",
    }),
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
    const problema = validarParDeSenhas(senha, confirmacao);
    if (problema) {
      toast.error(problema);
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
        <LogoGrancont className="mb-6 h-8 w-auto" />
        <h1 className="text-lg font-semibold text-foreground">Criar nova senha</h1>
        {!pronto ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Abra esta página pelo link enviado no e-mail de recuperação. O link é válido por tempo limitado.
          </p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={salvar}>
            <CamposSenha
              senha={senha}
              onSenhaChange={setSenha}
              confirmacao={confirmacao}
              onConfirmacaoChange={setConfirmacao}
              rotulo="Nova senha"
              rotuloConfirmacao="Confirmar nova senha"
              idSenha="nova-senha"
              disabled={carregando}
            />

            <Button type="submit" className="w-full" disabled={carregando}>
              Salvar nova senha
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
