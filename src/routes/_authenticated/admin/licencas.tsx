import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { metaPagina } from "@/lib/seo-head";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Clock, KeyRound, Search } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Carregando, ExigePapel } from "@/components/app/GuardaAcesso";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { atualizarLicenca, listarLicencas, type AcaoLicenca } from "@/lib/licencas.functions";

import { ROTULO_LICENCA, avaliarLicenca, type Licenca, type StatusLicenca } from "@/lib/licencas";

const TITULO = "Licenças — Administração Precifica Grancont";
const DESCRICAO =
  "Gerencie as licenças do Precifica Grancont: períodos de teste, liberações definitivas, suspensões e validade por usuário.";

export const Route = createFileRoute("/_authenticated/admin/licencas")({
  head: () => ({
    ...metaPagina({
      titulo: TITULO,
      descricao: DESCRICAO,
      caminho: "/admin/licencas",
    }),
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
  expired: "border-amber-500/50 text-amber-600",
  canceled: "border-destructive/40 text-destructive",
};

type Filtro = "atencao" | "teste" | "ativas" | "todas";
const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: "atencao", rotulo: "Precisam de liberação" },
  { id: "teste", rotulo: "Em teste" },
  { id: "ativas", rotulo: "Liberadas" },
  { id: "todas", rotulo: "Todas" },
];
const PRAZOS = [7, 15, 30, 60, 90, 365];

function grupo(s: StatusLicenca): Exclude<Filtro, "todas"> {
  if (s === "trial") return "teste";
  if (s === "active") return "ativas";
  return "atencao";
}

function PainelLicencas() {
  const listar = useServerFn(listarLicencas);
  const atualizar = useServerFn(atualizarLicenca);
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("atencao");
  const [prazos, setPrazos] = useState<Record<string, number>>({});
  const buscaDebounce = useDebounce(busca, 300);

  const licencas = useQuery({
    queryKey: ["admin", "licencas"],
    queryFn: async () => listar({ data: undefined as never }),
  });

  const acao = useMutation({
    mutationFn: async (v: {
      userId: string;
      acao: AcaoLicenca;
      dias?: number;
      observacao?: string;
      msg: string;
    }) => {
      const { msg: _msg, ...dados } = v;
      return atualizar({ data: dados });
    },
    onSuccess: (_r, v) => {
      toast.success(v.msg);
      queryClient.invalidateQueries({ queryKey: ["admin", "licencas"] });
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível atualizar a licença."),
  });

  const itens = useMemo(
    () =>
      (licencas.data ?? []).map((l) => ({
        ...l,
        situacao: avaliarLicenca(l as unknown as Licenca),
      })),
    [licencas.data],
  );

  const contagem = useMemo(() => {
    const c: Record<Filtro, number> = { atencao: 0, teste: 0, ativas: 0, todas: itens.length };
    for (const i of itens) c[grupo(i.situacao.status)]++;
    return c;
  }, [itens]);

  const lista = useMemo(() => {
    const termo = buscaDebounce.trim().toLowerCase();
    return itens.filter((l) => {
      if (filtro !== "todas" && grupo(l.situacao.status) !== filtro) return false;
      if (!termo) return true;
      return (
        (l.email ?? "").toLowerCase().includes(termo) ||
        (l.full_name ?? "").toLowerCase().includes(termo)
      );
    });
  }, [itens, filtro, buscaDebounce]);

  if (licencas.isLoading) return <Carregando texto="Carregando licenças…" />;
  if (licencas.error)
    return (
      <p className="m-6 rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
        Não foi possível carregar as licenças: {(licencas.error as Error).message}
      </p>
    );

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
          <KeyRound className="h-5 w-5 text-primary" aria-hidden /> Licenças e testes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Toda conta nova ganha 30 dias de teste. Quando vence, a pessoa aparece em{" "}
          <strong>Precisam de liberação</strong>: escolha o prazo e clique em{" "}
          <strong>Estender teste</strong> ou <strong>Liberar licença</strong>.
        </p>
      </header>

      <div role="tablist" aria-label="Filtrar licenças" className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <Button
            key={f.id}
            role="tab"
            aria-selected={filtro === f.id}
            size="sm"
            variant={filtro === f.id ? "default" : "outline"}
            onClick={() => setFiltro(f.id)}
          >
            {f.rotulo}
            <span className="ml-1.5 rounded-full bg-background/20 px-1.5 text-xs">
              {contagem[f.id]}
            </span>
          </Button>
        ))}
      </div>

      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          className="pl-9"
          placeholder="Buscar por nome ou e-mail"
          aria-label="Buscar por nome ou e-mail"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {lista.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          {filtro === "atencao"
            ? "Ninguém aguardando liberação no momento."
            : "Nenhuma licença encontrada."}
        </p>
      ) : (
        <ul className="space-y-3">
          {lista.map((l) => {
            const { situacao } = l;
            const dias = prazos[l.user_id] ?? 30;
            const nome = l.full_name ?? l.email ?? "usuário";
            const bloqueado = !situacao.liberado;
            const fim =
              situacao.status === "trial" || situacao.emTeste ? l.trial_ends_at : l.expires_at;
            const Icone = bloqueado
              ? AlertTriangle
              : situacao.status === "trial"
                ? Clock
                : CheckCircle2;
            return (
              <li
                key={l.user_id}
                className="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {l.full_name ?? "Sem nome"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{l.email ?? "—"}</p>
                  </div>
                  <Badge variant="outline" className={CORES[situacao.status]}>
                    <Icone className="mr-1 h-3.5 w-3.5" aria-hidden />
                    {situacao.emTeste && situacao.status === "expired"
                      ? "Teste vencido"
                      : ROTULO_LICENCA[situacao.status]}
                  </Badge>
                </div>

                <p className="mt-2 text-sm text-foreground">
                  {situacao.status === "active" && !l.expires_at
                    ? "Liberada sem prazo de vencimento."
                    : fim
                      ? `${bloqueado ? "Venceu em" : "Vence em"} ${dataBr(fim)}${
                          situacao.diasRestantes !== null && !bloqueado
                            ? ` (${situacao.diasRestantes} dia(s))`
                            : ""
                        }.`
                      : situacao.motivo}{" "}
                  <span className="text-xs text-muted-foreground">
                    Último acesso: {dataBr(l.last_access_at)}
                  </span>
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Prazo
                    <select
                      className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                      value={dias}
                      onChange={(e) =>
                        setPrazos((p) => ({ ...p, [l.user_id]: Number(e.target.value) }))
                      }
                    >
                      {PRAZOS.map((d) => (
                        <option key={d} value={d}>
                          {d} dias
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    size="sm"
                    disabled={acao.isPending}
                    onClick={() =>
                      acao.mutate({
                        userId: l.user_id,
                        acao: "reiniciar_teste",
                        dias,
                        msg: `Teste de ${nome} liberado por ${dias} dias.`,
                      })
                    }
                  >
                    {situacao.status === "trial"
                      ? `Novo teste de ${dias} dias`
                      : `Estender teste ${dias} dias`}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acao.isPending}
                    onClick={() =>
                      acao.mutate({
                        userId: l.user_id,
                        acao: "ativar",
                        dias,
                        msg: `Licença de ${nome} liberada por ${dias} dias.`,
                      })
                    }
                  >
                    Liberar licença {dias} dias
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acao.isPending}
                    onClick={() =>
                      acao.mutate({
                        userId: l.user_id,
                        acao: "ativar",
                        msg: `Licença de ${nome} liberada sem prazo.`,
                      })
                    }
                  >
                    Liberar sem prazo
                  </Button>
                  {situacao.liberado && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto text-destructive"
                      disabled={acao.isPending}
                      onClick={() => {
                        if (!window.confirm(`Suspender o acesso de ${nome}?`)) return;
                        acao.mutate({
                          userId: l.user_id,
                          acao: "suspender",
                          msg: `Acesso de ${nome} suspenso.`,
                        });
                      }}
                    >
                      Suspender
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
