import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { metaPagina } from "@/lib/seo-head";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Inbox, X } from "lucide-react";
import { toast } from "sonner";

import { ExigePapel, Carregando } from "@/components/app/GuardaAcesso";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AREAS_ADMIN,
  listarSolicitacoesAdmin,
  tratarSolicitacaoAdmin,
  type SolicitacaoAdmin,
} from "@/lib/solicitacao-admin.functions";

const TITULO = "Solicitações de acesso — Administração Precifica Grancont";
const DESCRICAO =
  "Analise os pedidos de acesso administrativo enviados pelos usuários do Precifica Grancont.";

export const Route = createFileRoute("/_authenticated/admin/solicitacoes")({
  head: () => ({
    ...metaPagina({
      titulo: TITULO,
      descricao: DESCRICAO,
      caminho: "/admin/solicitacoes",
    }),
  }),
  component: () => (
    <ExigePapel papel="super_admin">
      <PainelSolicitacoes />
    </ExigePapel>
  ),
});

const ROTULO_STATUS: Record<string, string> = {
  pending: "Em análise",
  approved: "Aprovada",
  rejected: "Recusada",
};

function rotuloArea(area: string | null) {
  if (!area) return "Não informada";
  return AREAS_ADMIN[area as keyof typeof AREAS_ADMIN] ?? area;
}

function dataBr(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function PainelSolicitacoes() {
  const listar = useServerFn(listarSolicitacoesAdmin);
  const tratar = useServerFn(tratarSolicitacaoAdmin);
  const queryClient = useQueryClient();

  const pedidos = useQuery({
    queryKey: ["admin", "solicitacoes-acesso"],
    queryFn: async () => listar({ data: undefined as never }),
  });

  const decisao = useMutation({
    mutationFn: async (v: { id: string; decisao: "approved" | "rejected" }) => tratar({ data: v }),
    onSuccess: () => {
      toast.success("Solicitação atualizada.");
      queryClient.invalidateQueries({ queryKey: ["admin", "solicitacoes-acesso"] });
    },
    onError: () => toast.error("Não foi possível atualizar a solicitação."),
  });

  if (pedidos.isLoading) return <Carregando texto="Carregando solicitações…" />;

  const lista = pedidos.data ?? [];
  const pendentes = lista.filter((p) => p.status === "pending");

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Solicitações de acesso
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedidos de acesso administrativo enviados pelos usuários. Aprovar aqui registra a decisão;
          a concessão do papel continua sendo feita em Usuários ou Convites.
        </p>
      </header>

      {lista.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-10 text-center">
          <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">Nenhuma solicitação registrada.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {pendentes.length} em análise · {lista.length} no total
          </p>
          <ul className="space-y-3">
            {lista.map((p) => (
              <CartaoSolicitacao
                key={p.id}
                pedido={p}
                ocupado={decisao.isPending}
                onDecidir={(d) => decisao.mutate({ id: p.id, decisao: d })}
              />
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

function CartaoSolicitacao({
  pedido,
  ocupado,
  onDecidir,
}: {
  pedido: SolicitacaoAdmin;
  ocupado: boolean;
  onDecidir: (d: "approved" | "rejected") => void;
}) {
  const pendente = pedido.status === "pending";
  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {pedido.solicitanteNome ?? "Usuário"}
          </p>
          <p className="truncate text-xs text-muted-foreground">{pedido.solicitanteEmail ?? "—"}</p>
        </div>
        <Badge variant={pendente ? "default" : "secondary"}>
          {ROTULO_STATUS[pedido.status] ?? pedido.status}
        </Badge>
      </div>

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Área solicitada</dt>
          <dd className="text-foreground">{rotuloArea(pedido.area)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Enviada em</dt>
          <dd className="text-foreground">{dataBr(pedido.criadoEm)}</dd>
        </div>
        {pedido.contato ? (
          <div>
            <dt className="text-muted-foreground">Contato</dt>
            <dd className="break-all text-foreground">{pedido.contato}</dd>
          </div>
        ) : null}
        {!pendente ? (
          <div>
            <dt className="text-muted-foreground">Tratada</dt>
            <dd className="text-foreground">
              {dataBr(pedido.tratadoEm)}
              {pedido.tratadoPor ? ` · ${pedido.tratadoPor}` : ""}
            </dd>
          </div>
        ) : null}
      </dl>

      <p className="mt-3 whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs text-foreground">
        {pedido.motivo}
      </p>

      {pendente ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" disabled={ocupado} onClick={() => onDecidir("approved")}>
            <Check className="h-4 w-4" aria-hidden />
            Aprovar
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={ocupado}
            onClick={() => onDecidir("rejected")}
          >
            <X className="h-4 w-4" aria-hidden />
            Recusar
          </Button>
        </div>
      ) : null}
    </li>
  );
}
