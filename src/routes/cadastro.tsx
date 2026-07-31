import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { ReenviarConfirmacao } from "@/components/app/ReenviarConfirmacao";
import { LogoGrancont } from "@/components/app/LogoGrancont";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { registrarEventoEmail } from "@/lib/email-eventos.functions";

const TITULO = "Criar conta — Precifica Grancont";
const DESCRICAO =
  "Crie sua conta no Precifica Grancont, confirme o e-mail e teste o simulador de precificação tributária por 30 dias sem limites.";

export const Route = createFileRoute("/cadastro")({
  validateSearch: z.object({ email: z.string().optional() }),
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
  component: CadastrarPage,
});

function CadastrarPage() {
  const navigate = useNavigate();
  const { email: emailInicial } = Route.useSearch();
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState(emailInicial ?? "");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const cadastrar = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailLimpo = email.trim().toLowerCase();
    if (senha.length < 8) {
      toast.error("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    setCarregando(true);
    try {
      void registrarEventoEmail({ data: { tipo: "cadastro_solicitado", email: emailLimpo } }).catch(() => {});

      const { error } = await supabase.auth.signUp({
        email: emailLimpo,
        password: senha,
        options: {
          emailRedirectTo: `${window.location.origin}/entrando`,
          data: { full_name: nome.trim(), company_name: empresa.trim() },
        },
      });
      void registrarEventoEmail({
        data: {
          tipo: "confirmacao_enviada",
          email: emailLimpo,
          status: error ? "erro" : "ok",
          codigoErro: error?.code ?? undefined,
          mensagemErro: error?.message ?? undefined,
        },
      }).catch(() => {});

      if (!error) {
        void registrarEventoEmail({ data: { tipo: "senha_criada", email: emailLimpo } }).catch(() => {});
      }

      // Mensagem genérica: a tela é sempre a mesma, exista ou não uma conta com este e-mail.
      setEnviado(true);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Toaster />
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
        <LogoGrancont className="h-9 w-auto" />
        {enviado ? (
          <div className="mt-6 text-center">
            <MailCheck className="mx-auto h-9 w-9 text-primary" aria-hidden />
            <h1 className="mt-3 text-lg font-semibold text-foreground">Confirme seu e-mail</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enviamos um link de confirmação para <span className="font-medium text-foreground">{email}</span>. Abra o
              link para ativar a conta e iniciar seus 30 dias de teste gratuito.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Não recebeu? Confira a caixa de spam e o lixo eletrônico, e confirme se o endereço está correto.
            </p>
            <ReenviarConfirmacao email={email} className="mt-5 text-left" />
            <Link to="/login" className="mt-6 inline-block text-sm text-primary hover:underline">
              Voltar para o login
            </Link>
          </div>
        ) : (
          <>
            <h1 className="mt-5 text-xl font-semibold tracking-tight text-foreground">Criar sua conta</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Confirmação por e-mail e 30 dias de teste gratuito, sem limites.
            </p>

            <form className="mt-6 space-y-4" onSubmit={cadastrar}>
              <div className="space-y-1.5">
                <Label htmlFor="nome">Seu nome</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={120} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="empresa">Empresa</Label>
                <Input
                  id="empresa"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  placeholder="Nome da sua empresa"
                  maxLength={160}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="senha">Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
              </div>
              <Button type="submit" className="w-full" disabled={carregando}>
                {carregando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Criar conta"}
              </Button>
            </form>

            <ul className="mt-5 space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden /> Acesso completo por 30 dias
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden /> Após o período, a liberação depende do
                Administrador Grancont
              </li>
            </ul>

            <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
              Já tem conta?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Entrar
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
