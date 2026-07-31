import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Eye, EyeOff, Info, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DialogoCadastrar } from "@/components/app/DialogoCadastrar";
import { ReenviarConfirmacao } from "@/components/app/ReenviarConfirmacao";
import { LogoGrancont } from "@/components/app/LogoGrancont";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { verificarEmailCadastrado } from "@/lib/conta.functions";

const TITULO = "Entrar — Precifica Grancont";
const DESCRICAO =
  "Acesse o Precifica Grancont com o e-mail autorizado pela sua empresa para simular preços, consultar histórico e usar os perfis tributários liberados.";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: TITULO },
      { name: "description", content: DESCRICAO },
      { property: "og:title", content: TITULO },
      { property: "og:description", content: DESCRICAO },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  ssr: false,
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [situacaoEmail, setSituacaoEmail] = useState<"desconhecida" | "cadastrado" | "novo">("desconhecida");
  const [dialogo, setDialogo] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/entrando", replace: true });
    });
  }, [navigate]);

  const conferirEmail = async (valor: string) => {
    const limpo = valor.trim().toLowerCase();
    if (!limpo || !limpo.includes("@")) {
      setSituacaoEmail("desconhecida");
      return null;
    }
    try {
      const { cadastrado } = await verificarEmailCadastrado({ data: { email: limpo } });
      setSituacaoEmail(cadastrado ? "cadastrado" : "novo");
      return cadastrado;
    } catch {
      setSituacaoEmail("desconhecida");
      return null;
    }
  };

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    const emailLimpo = email.trim().toLowerCase();

    const cadastrado = await conferirEmail(emailLimpo);
    if (cadastrado === false) {
      setCarregando(false);
      setDialogo(true);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: emailLimpo,
      password: senha,
    });
    setCarregando(false);
    if (error) {
      const naoConfirmado = error.message.toLowerCase().includes("not confirmed");
      setPendenteConfirmacao(naoConfirmado ? emailLimpo : null);
      toast.error(
        naoConfirmado
          ? "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada."
          : "Senha incorreta para este e-mail.",
      );
      return;
    }
    setPendenteConfirmacao(null);
    navigate({ to: "/entrando", replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Toaster />
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
        <LogoGrancont className="h-9 w-auto" />
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-foreground">
          Precifica <span className="text-primary">Grancont</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Entre com seu e-mail e senha.</p>

        <form className="mt-6 space-y-4" onSubmit={entrar}>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSituacaoEmail("desconhecida");
              }}
              onBlur={(e) => void conferirEmail(e.target.value)}
              required
            />
            {situacaoEmail === "cadastrado" && (
              <p className="flex items-center gap-1.5 text-xs text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> E-mail já cadastrado.
              </p>
            )}
            {situacaoEmail === "novo" && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5" aria-hidden /> E-mail ainda não cadastrado.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="senha">Senha</Label>
            <div className="relative">
              <Input
                id="senha"
                type={mostrar ? "text" : "password"}
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setMostrar((v) => !v)}
                aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                {mostrar ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={carregando}>
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Entrar"}
          </Button>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
          <Link to="/esqueci-minha-senha" className="text-primary hover:underline">
            Esqueci minha senha
          </Link>
          <Link to="/cadastrar" className="text-primary hover:underline">
            Criar conta — 30 dias grátis
          </Link>
        </div>

        <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
          Novas contas passam por confirmação de e-mail e recebem 30 dias de teste gratuito.
          <br />
          Seu acesso é individual e não deve ser compartilhado.
        </p>
      </div>

      <DialogoCadastrar aberto={dialogo} email={email.trim().toLowerCase()} onFechar={() => setDialogo(false)} />
    </main>
  );
}
