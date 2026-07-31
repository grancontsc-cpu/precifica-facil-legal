import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Carregando, ExigePapel } from "@/components/app/GuardaAcesso";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { atualizarLicenca, listarLicencas } from "@/lib/licencas.functions";
import { ROTULO_LICENCA, avaliarLicenca, type Licenca, type StatusLicenca } from "@/lib/licencas";

const TITULO = "Licenças — Administração Precifica Grancont";
const DESCRICAO =
  "Gerencie as licenças do Precifica Grancont: períodos de teste, liberações definitivas, suspensões e validade por usuário.";

export const Route = createFileRoute("/_authenticated/admin/licencas")({
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
  component: () => (
    <ExigePapel papel="super_admin">
      <PainelLicencas />
    </ExigePapel>
  ),
});

function dataBr(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { dateStyle: "short" });
}

const CORES: Record<StatusLicenca, string> = {
  trial: "border-primary/30 text-primary",
  active: "border-emerald-500/40 text-emerald-600",
  suspended: "border-destructive/40 text-destructive",
  expired: "border-muted-foreground/40 text-muted-foreground",
};

function PainelLicencas() {
  const listar = useServerFn(listarLicencas);
  const atualizar = useServerFn(atualizarLicenca);
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");

  const licencas = useQuery({
    queryKey: ["admin", "licencas"],
    queryFn: async () => listar({ data: undefined as never }),
  });

  const acao = useMutation({
    mutationFn: async (v: Parameters<typeof atualizarLicenca>[0]["data"]) => atualizar({ data: v }),
    onSuccess: () => {
      toast.success("Licença atualizada.");
      queryClient.invalidateQueries({ queryKey: ["admin", "licencas"] });
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível atualizar a licença."),
  });

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const todas = licencas.data ?? [];
    if (!termo) return todas;
    return todas.filter(
      (l) => (l.email ?? "").toLowerCase().includes(termo) || (l.full_name ?? "").toLowerCase().includes(termo),
    );
  }, [licencas.data, busca]);

  if (licencas.isLoading) return <Carregando texto="Carregando licenças…" />;

  const resumo = (licencas.data ?? []).reduce<Record<string, number>>((acc, l) => {
    const s = avaliarLicenca(l as unknown as Licenca).status;
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
          <KeyRound className="h-5 w-5 text-primary" aria-hidden /> Gestão de licenças
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada conta nova recebe 30 dias de teste gratuito. Depois disso, o acesso fica suspenso até a liberação aqui.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(["trial", "active", "suspended", "expired"] as StatusLicenca[]).map((s) => (
          <Badge key={s} variant="outline" className={CORES[s]}>
            {ROTULO_LICENCA[s]}: {resumo[s] ?? 0}
          </Badge>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          className="pl-9"
          placeholder="Buscar por nome ou e-mail"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {lista.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          Nenhuma licença encontrada.
        </p>
      ) : (
        <ul className="space-y-3">
          {lista.map((l) => {
            const situacao = avaliarLicenca(l as unknown as Licenca);
            return (
              <li key={l.user_id} className="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{l.full_name ?? "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground">{l.email ?? "—"}</p>
                  </div>
                  <Badge variant="outline" className={CORES[situacao.status]}>
                    {ROTULO_LICENCA[situacao.status]}
                  </Badge>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                  <div>
                    <dt>Plano</dt>
                    <dd className="text-foreground">{l.plan}</dd>
                  </div>
                  <div>
                    <dt>Teste até</dt>
                    <dd className="text-foreground">{dataBr(l.trial_ends_at)}</dd>
                  </div>
                  <div>
                    <dt>Validade</dt>
                    <dd className="text-foreground">{l.expires_at ? dataBr(l.expires_at) : "Sem prazo"}</dd>
                  </div>
                  <div>
                    <dt>Último acesso</dt>
                    <dd className="text-foreground">{dataBr(l.last_access_at)}</dd>
                  </div>
                </dl>

                <p className="mt-2 text-xs text-muted-foreground">{situacao.motivo}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={acao.isPending}
                    onClick={() => acao.mutate({ userId: l.user_id, acao: "ativar" })}
                  >
                    Liberar licença
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acao.isPending}
                    onClick={() => acao.mutate({ userId: l.user_id, acao: "estender_teste", dias: 30 })}
                  >
                    +30 dias de teste
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acao.isPending}
                    onClick={() => acao.mutate({ userId: l.user_id, acao: "suspender" })}
                  >
                    Suspender
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={acao.isPending}
                    onClick={() => acao.mutate({ userId: l.user_id, acao: "expirar" })}
                  >
                    Encerrar
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
