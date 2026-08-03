import { metaPagina } from "@/lib/seo-head";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { Carregando, ExigePapel } from "@/components/app/GuardaAcesso";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listarPedidosVinculo, responderPedidoVinculo } from "@/lib/vinculos.functions";

const TITULO = "Pedidos de vínculo — Precifica Grancont";
const DESCRICAO = "Aprove ou recuse quem pediu para entrar na sua empresa no Precifica Grancont.";

export const Route = createFileRoute("/_authenticated/gestao/vinculos")({
  head: () => ({
    ...metaPagina({
      titulo: TITULO,
      descricao: DESCRICAO,
      caminho: "/gestao/vinculos",
    }),
  }),
  component: Pagina,
});

const ROTULO_STATUS: Record<string, string> = {
  pending: "Aguardando resposta",
  approved: "Aprovado",
  rejected: "Recusado",
};

function Pagina() {
  return (
    <ExigePapel papel="manager">
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Pedidos de vínculo
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pessoas que se cadastraram com o CNPJ da empresa e aguardam liberação de acesso.
          </p>
        </header>
        <Lista />
      </main>
    </ExigePapel>
  );
}

function Lista() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["pedidos-vinculo"],
    queryFn: () => listarPedidosVinculo(),
  });

  const responder = useMutation({
    mutationFn: (entrada: {
      pedidoId: string;
      decisao: "aprovar" | "recusar";
      papel?: "user" | "manager";
    }) => responderPedidoVinculo({ data: { ...entrada, papel: entrada.papel ?? "user" } }),
    onSuccess: (_r, entrada) => {
      toast.success(entrada.decisao === "aprovar" ? "Acesso liberado." : "Pedido recusado.");
      void queryClient.invalidateQueries({ queryKey: ["pedidos-vinculo"] });
    },
    onError: (erro) =>
      toast.error(erro instanceof Error ? erro.message : "Não foi possível registrar a decisão."),
  });

  if (isLoading) return <Carregando texto="Carregando pedidos…" />;
  if (error)
    return (
      <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        {error instanceof Error ? error.message : "Não foi possível carregar os pedidos."}
      </p>
    );

  const pedidos = data ?? [];
  if (pedidos.length === 0)
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
        <UserPlus className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="mt-3 text-sm text-muted-foreground">Nenhum pedido de vínculo no momento.</p>
      </div>
    );

  return (
    <ul className="space-y-3">
      {pedidos.map((p) => (
        <li
          key={p.id}
          className="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {p.solicitanteNome ?? p.nomeInformado ?? "Usuário sem nome"}
              </p>
              <p className="truncate text-xs text-muted-foreground">{p.solicitanteEmail ?? "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Empresa: {p.organizacaoNome ?? "—"}
                {p.cnpj ? ` · CNPJ ${p.cnpj}` : ""} ·{" "}
                {new Date(p.criadoEm).toLocaleDateString("pt-BR", { dateStyle: "short" })}
              </p>
            </div>

            {p.status === "pending" ? (
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={responder.isPending}
                  onClick={() => responder.mutate({ pedidoId: p.id, decisao: "recusar" })}
                >
                  <X className="mr-1 h-4 w-4" aria-hidden /> Recusar
                </Button>
                <Button
                  size="sm"
                  disabled={responder.isPending}
                  onClick={() => responder.mutate({ pedidoId: p.id, decisao: "aprovar" })}
                >
                  {responder.isPending ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="mr-1 h-4 w-4" aria-hidden />
                  )}
                  Aprovar
                </Button>
              </div>
            ) : (
              <Badge variant="secondary">{ROTULO_STATUS[p.status] ?? p.status}</Badge>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
