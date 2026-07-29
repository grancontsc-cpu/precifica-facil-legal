import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const TITULO = "Acesso bloqueado — Precifica Grancont";
const DESCRICAO = "Seu acesso ao Precifica Grancont está temporariamente suspenso. Fale com o administrador da sua empresa.";

export const Route = createFileRoute("/acesso-bloqueado")({
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
  component: () => (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
        <ShieldAlert className="mx-auto h-8 w-8 text-destructive" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold text-foreground">Acesso suspenso</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Seu acesso está temporariamente suspenso. Entre em contato com o administrador da sua empresa ou com a
          Grancont para regularizar.
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
        <Link to="/login" className="mt-3 inline-block text-xs text-primary hover:underline">
          Voltar para o login
        </Link>
      </div>
    </main>
  ),
});
