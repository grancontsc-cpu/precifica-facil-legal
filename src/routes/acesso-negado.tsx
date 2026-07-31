import { metaPagina } from "@/lib/seo-head";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";

import { SolicitarAcessoAdmin } from "@/components/app/SolicitarAcessoAdmin";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const TITULO = "Acesso negado — Precifica Grancont";
const DESCRICAO = "Você não tem permissão para acessar esta área do Precifica Grancont.";

export const Route = createFileRoute("/acesso-negado")({
  head: () => ({
    ...metaPagina({
      titulo: TITULO,
      descricao: DESCRICAO,
      caminho: "/acesso-negado",
    }),
  }),
  ssr: false,
  component: () => (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
        <Lock className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sua conta não possui permissão para esta área ou ainda não está vinculada a uma empresa. Solicite liberação
          ao administrador.
        </p>
        <div className="mt-6 grid gap-2">
          <SolicitarAcessoAdmin className="w-full" />
          <Button variant="outline" onClick={() => window.history.back()}>
            Voltar
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
          >
            Sair
          </Button>
        </div>
        <Link to="/login" className="mt-3 inline-block text-xs text-primary hover:underline">
          Ir para o login
        </Link>
      </div>
    </main>
  ),
});
