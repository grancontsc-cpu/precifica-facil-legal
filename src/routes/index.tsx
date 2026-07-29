import { createFileRoute, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

const TITULO = "Precifica Grancont — precificação com perfis tributários";
const DESCRICAO =
  "Sistema de precificação da Grancont: simulador com memória de cálculo, perfis tributários versionados por empresa e histórico completo de simulações.";

export const Route = createFileRoute("/")({
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
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? "/simulador" : "/auth" });
  },
  component: () => null,
});
