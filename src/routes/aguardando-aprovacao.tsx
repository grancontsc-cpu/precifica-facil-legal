import { metaPagina } from "@/lib/seo-head";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Hourglass } from "lucide-react";

import { LogoGrancont } from "@/components/app/LogoGrancont";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const TITULO = "Aguardando aprovação — Precifica Grancont";
const DESCRICAO = "Sua conta no Precifica Grancont está aguardando aprovação de um administrador.";

export const Route = createFileRoute("/aguardando-aprovacao")({
  head: () => ({
    ...metaPagina({
      titulo: TITULO,
      descricao: DESCRICAO,
      caminho: "/aguardando-aprovacao",
    }),
  }),
  ssr: false,
  component: () => (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
        <LogoGrancont className="mx-auto mb-6 h-8 w-auto" />
        <Hourglass className="mx-auto h-8 w-8 text-primary" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold text-foreground">Aguardando aprovação</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sua conta foi criada e está em análise. Você receberá um aviso por e-mail assim que o
          acesso for liberado.
        </p>
        <Button
          variant="outline"
          className="mt-6 w-full"
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
        >
          Sair
        </Button>
        <Link
          to="/login"
          search={{ next: undefined }}
          className="mt-3 inline-block text-xs text-primary hover:underline"
        >
          Voltar para o login
        </Link>
      </div>
    </main>
  ),
});
