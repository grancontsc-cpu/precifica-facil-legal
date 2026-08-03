import { metaPagina } from "@/lib/seo-head";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ReenviarConfirmacao } from "@/components/app/ReenviarConfirmacao";
import { LogoGrancont } from "@/components/app/LogoGrancont";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const TITULO = "Entrar — Precifica Grancont";
const DESCRICAO =
  "Acesse o Precifica Grancont com o e-mail autorizado pela sua empresa para simular preços, consultar histórico e usar os perfis tributários liberados.";

/** Só aceita caminho relativo de mesma origem como retorno pós-login. */
function destinoSeguro(next: string | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export const Route = createFileRoute("/login")({
  head: () => ({
    ...metaPagina({
      titulo: TITULO,
      descricao: DESCRICAO,
      caminho: "/login",
      indexavel: true,
    }),
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  ssr: false,
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const retorno = destinoSeguro(next);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [pendenteConfirmacao, setPendenteConfirmacao] = useState<string | null>(null);

  const seguir = () => {
    if (retorno) window.location.replace(retorno);
    else navigate({ to: "/entrando", replace: true });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) seguir();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    const emailLimpo = email.trim().toLowerCase();

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
    seguir();
  };

  return (
    <>
      <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
        {/* Painel de contexto: prova, autoridade e resultado esperado antes do formulário. */}
        <aside className="relative hidden overflow-hidden bg-graphite px-12 py-14 lg:flex lg:flex-col lg:justify-between">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand/25 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              color: "white",
            }}
          />
          <div className="relative">
            <LogoGrancont className="h-9 w-auto" variante="clara" />
          </div>

          <div className="relative max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-background/60">
              Precificação com base fiscal
            </p>
            <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-background">
              Saiba o preço mínimo antes de dar o desconto.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-background/70">
              Desembolso, crédito recuperável e custo líquido separados linha a linha — com a
              memória de cálculo que você mostra para o cliente e para a contabilidade.
            </p>

            <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-background/15 pt-6">
              {[
                { valor: "12", rotulo: "tributos tratados" },
                { valor: "30", rotulo: "dias de teste" },
                { valor: "100%", rotulo: "cálculo auditável" },
              ].map((item) => (
                <div key={item.rotulo}>
                  <dt className="num-destaque text-2xl font-semibold text-background">
                    {item.valor}
                  </dt>
                  <dd className="mt-1 text-xs leading-snug text-background/60">{item.rotulo}</dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="relative max-w-md text-xs leading-relaxed text-background/50">
            Sistema de uso interno das empresas atendidas pela Grancont — Contabilidade e
            inteligência fiscal.
          </p>
        </aside>

        <div className="flex items-center justify-center bg-background px-4 py-10 sm:px-8">
          <div className="w-full max-w-[26rem]">
            <div className="lg:hidden">
              <LogoGrancont className="h-9 w-auto" />
            </div>

            <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground lg:mt-0">
              Precifica <span className="text-primary">Grancont</span> — Simulador de Precificação
              Fiscal
            </h1>

            <p className="mt-1.5 text-sm text-muted-foreground">
              Entre para retomar suas simulações de onde parou.
            </p>

            <form className="mt-8 space-y-5" onSubmit={entrar}>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="voce@suaempresa.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="senha">Senha</Label>
                  <Link
                    to="/recuperar-senha"
                    className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                  >
                    Esqueci minha senha
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="senha"
                    type={mostrar ? "text" : "password"}
                    autoComplete="current-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    className="pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrar((v) => !v)}
                    aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {mostrar ? (
                      <EyeOff className="h-4 w-4" aria-hidden />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={carregando}>
                {carregando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Entrando…
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>

            {pendenteConfirmacao && (
              <div className="mt-5 rounded-lg border border-warning/40 bg-warning/10 p-4">
                <p className="text-xs leading-relaxed text-foreground">
                  Sua conta ainda não foi confirmada. Abra o link enviado para{" "}
                  <span className="font-semibold">{pendenteConfirmacao}</span> ou peça um novo.
                </p>
                <ReenviarConfirmacao
                  email={pendenteConfirmacao}
                  iniciarBloqueado={false}
                  className="mt-3"
                />
              </div>
            )}

            <div className="mt-8 rounded-xl border border-border bg-surface p-4">
              <p className="text-sm font-semibold text-foreground">Ainda não tem acesso?</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Crie sua conta e use o sistema completo por 30 dias, sem cartão de crédito.
              </p>
              <Button asChild variant="outline" className="mt-3 w-full">
                <Link to="/cadastro">Criar conta — 30 dias grátis</Link>
              </Button>
            </div>

            <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
              Novas contas passam por confirmação de e-mail. Seu acesso é individual e não deve ser
              compartilhado.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
