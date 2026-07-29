import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { LogoGrancont } from "@/components/app/LogoGrancont";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/entrando", replace: true });
    });
  }, [navigate]);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    });
    setCarregando(false);
    if (error) {
      toast.error("E-mail ou senha inválidos.");
      return;
    }
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
        <p className="mt-1 text-sm text-muted-foreground">Entre com o e-mail autorizado pela sua empresa.</p>

        <form className="mt-6 space-y-4" onSubmit={entrar}>
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

        <div className="mt-4 flex justify-between text-xs">
          <Link to="/esqueci-minha-senha" className="text-primary hover:underline">
            Esqueci minha senha
          </Link>
        </div>

        <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
          O acesso é exclusivo para usuários autorizados e liberado por convite.
          <br />
          Seu acesso é individual e não deve ser compartilhado.
        </p>
      </div>
    </main>
  );
}
