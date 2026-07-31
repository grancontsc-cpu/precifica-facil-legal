import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { LogoGrancont } from "@/components/app/LogoGrancont";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type DetalhesAutorizacao = {
  client?: { name?: string | null } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
} | null;

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: DetalhesAutorizacao; error: Error | null }>;
  approveAuthorization: (id: string) => Promise<{ data: DetalhesAutorizacao; error: Error | null }>;
  denyAuthorization: (id: string) => Promise<{ data: DetalhesAutorizacao; error: Error | null }>;
};

function oauth(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Requisição sem authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/login", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const imediato = data?.redirect_url ?? data?.redirect_to;
    if (imediato && !data?.client) throw redirect({ href: imediato });
    return data;
  },
  component: Consentimento,
  errorComponent: ({ error }) => (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 px-6">
      <h1 className="text-lg font-semibold text-foreground">Não foi possível carregar a autorização</h1>
      <p className="text-sm text-muted-foreground">
        {String((error as Error)?.message ?? error)}
      </p>
    </main>
  ),
});

function Consentimento() {
  const detalhes = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const nomeCliente = detalhes?.client?.name ?? "o aplicativo";

  async function decidir(aprovar: boolean) {
    setOcupado(true);
    setErro(null);
    const { data, error } = aprovar
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setOcupado(false);
      setErro(error.message);
      return;
    }
    const destino = data?.redirect_url ?? data?.redirect_to;
    if (!destino) {
      setOcupado(false);
      setErro("O servidor de autorização não devolveu um endereço de retorno.");
      return;
    }
    window.location.href = destino;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <LogoGrancont className="h-9 w-auto" />
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Conectar {nomeCliente} à sua conta
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {nomeCliente} poderá usar as ferramentas do Precifica Grancont em seu nome: simular
          preços e consultar produtos e simulações que você já tem permissão para ver. As mesmas
          regras de acesso da sua empresa continuam valendo.
        </p>
      </div>

      {erro ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button disabled={ocupado} onClick={() => decidir(true)} className="flex-1">
          Autorizar
        </Button>
        <Button
          disabled={ocupado}
          variant="outline"
          onClick={() => decidir(false)}
          className="flex-1"
        >
          Recusar
        </Button>
      </div>
    </main>
  );
}
