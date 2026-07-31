import { metaPagina } from "@/lib/seo-head";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

const TITULO = "Precifica Grancont — precificação com perfis tributários";
const DESCRICAO =
  "Sistema de precificação da Grancont: simulador com memória de cálculo, perfis tributários versionados por empresa e histórico completo de simulações.";

export const Route = createFileRoute("/")({
  head: () => ({
    ...metaPagina({
      titulo: TITULO,
      descricao: DESCRICAO,
      caminho: "/",
      indexavel: true,
    }),
  }),
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? "/entrando" : "/login" });
  },
  component: () => null,
});
