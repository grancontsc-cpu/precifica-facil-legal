import { metaPagina } from "@/lib/seo-head";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { Carregando } from "@/components/app/GuardaAcesso";
import { supabase } from "@/integrations/supabase/client";
import { avaliarLicenca, rotaBloqueio, type Licenca } from "@/lib/licencas";

const TITULO = "Acesso bloqueado — Precifica Grancont";
const DESCRICAO =
  "Seu acesso ao Precifica Grancont está bloqueado. Solicite a liberação da licença ao Administrador Grancont.";

/** Rota legada: encaminha para o aviso específico (teste expirado ou licença suspensa). */
export const Route = createFileRoute("/acesso-bloqueado")({
  head: () => ({
    ...metaPagina({
      titulo: TITULO,
      descricao: DESCRICAO,
      caminho: "/acesso-bloqueado",
    }),
  }),
  ssr: false,
  component: Pagina,
});

function Pagina() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: sessao } = await supabase.auth.getUser();
      if (!sessao.user) {
        navigate({ to: "/login", search: { next: undefined }, replace: true });
        return;
      }
      const { data } = await supabase
        .from("licenses")
        .select("status, plan, trial_started_at, trial_ends_at, activated_at, expires_at, notes")
        .eq("user_id", sessao.user.id)
        .maybeSingle();
      navigate({ to: rotaBloqueio(avaliarLicenca((data as Licenca | null) ?? null)), replace: true });
    })();
  }, [navigate]);

  return (
    <main className="min-h-screen bg-background">
      <Carregando marca texto="Verificando sua licença…" />
    </main>
  );
}
