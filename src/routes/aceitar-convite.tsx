import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Carregando } from "@/components/app/GuardaAcesso";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { aceitarConvite, consultarConvite } from "@/lib/invite.functions";

const TITULO = "Aceitar convite — Precifica Grancont";
const DESCRICAO = "Crie sua senha e ative o acesso ao Precifica Grancont a partir do convite recebido.";

type Busca = { token?: string };

export const Route = createFileRoute("/aceitar-convite")({
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
  validateSearch: (search: Record<string, unknown>): Busca => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: Pagina,
});

function Pagina() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [termos, setTermos] = useState(false);

  const conviteQuery = useQuery({
    queryKey: ["convite", token],
    enabled: !!token,
    retry: false,
    queryFn: () => consultarConvite({ data: { token: token! } }),
  });

  const aceite = useMutation({
    mutationFn: async () =>
      aceitarConvite({
        data: { token: token!, fullName: nome.trim(), password: senha, aceitouTermos: true },
      }),
    onSuccess: async (r) => {
      const { error } = await supabase.auth.signInWithPassword({ email: r.email, password: senha });
      if (error) {
        toast.success("Acesso criado. Faça login para continuar.");
        navigate({ to: "/login", replace: true });
        return;
      }
      navigate({ to: "/entrando", replace: true });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível aceitar o convite."),
  });

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (nome.trim().length < 3) return toast.error("Informe seu nome completo.");
    if (senha.length < 8) return toast.error("A senha deve ter ao menos 8 caracteres.");
    if (senha !== confirmacao) return toast.error("As senhas não conferem.");
    if (!termos) return toast.error("É necessário aceitar os termos de uso.");
    aceite.mutate();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Toaster />
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <h1 className="text-lg font-semibold text-foreground">Aceitar convite</h1>

        {!token ? (
          <p className="mt-4 text-sm text-muted-foreground">Link inválido: o convite não foi informado.</p>
        ) : conviteQuery.isLoading ? (
          <Carregando texto="Validando convite…" />
        ) : !conviteQuery.data?.valido ? (
          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {conviteQuery.data?.motivo ?? "Convite inválido."} Solicite um novo convite ao administrador.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              Convite para <strong className="text-foreground">{conviteQuery.data.email}</strong> na empresa{" "}
              <strong className="text-foreground">{conviteQuery.data.empresa}</strong> como{" "}
              {conviteQuery.data.papel === "manager" ? "Gestor" : "Usuário"}.
            </p>
            <form className="mt-6 space-y-4" onSubmit={enviar}>
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome completo</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s1">Senha</Label>
                <Input id="s1" type="password" minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s2">Confirmar senha</Label>
                <Input
                  id="s2"
                  type="password"
                  minLength={8}
                  value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)}
                  required
                />
              </div>
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <Checkbox checked={termos} onCheckedChange={(v) => setTermos(v === true)} className="mt-0.5" />
                Li e aceito os termos de uso e a política de privacidade do Precifica Grancont.
              </label>
              <Button type="submit" className="w-full" disabled={aceite.isPending}>
                Ativar meu acesso
              </Button>
            </form>
          </>
        )}

        <Link to="/login" className="mt-4 inline-block text-xs text-primary hover:underline">
          Voltar para o login
        </Link>
      </div>
    </main>
  );
}
