import { useQuery } from "@tanstack/react-query";
import { metaPagina } from "@/lib/seo-head";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import { supabase } from "@/integrations/supabase/client";

const TITULO = "Auditoria — Precifica Grancont";
const DESCRICAO =
  "Registro de alterações em perfis tributários e simulações, com autor, data e valores anteriores.";

const ROTULOS: Record<string, string> = {
  tax_profiles: "Perfil tributário",
  tax_profile_lines: "Linha do perfil tributário",
  simulations: "Simulação",
  simulation_purchase_lines: "Linha de compra da simulação",
  simulation_tax_lines: "Linha de tributo da simulação",
  simulation_sale_expenses: "Despesa de venda da simulação",
  seguranca_simulacao: "Segurança — acesso a simulação",
};

const ACOES: Record<string, string> = {
  insert: "criação",
  update: "alteração",
  delete: "exclusão",
  solicitacao_acesso: "solicitação de acesso",
  acesso_negado_carregar: "tentativa negada de abrir",

  acesso_negado_salvar: "tentativa negada de salvar",
  acesso_negado_criar: "tentativa negada de criar",
  acesso_negado_duplicar: "tentativa negada de duplicar",
  acesso_negado_arquivar: "tentativa negada de arquivar",
};

const FILTROS = [
  { id: "todos", rotulo: "Todos" },
  { id: "simulacoes", rotulo: "Simulações" },
  { id: "perfis", rotulo: "Perfis tributários" },
  { id: "seguranca", rotulo: "Segurança" },
] as const;

function grupoDaEntidade(entidade: string) {
  if (entidade === "seguranca_simulacao") return "seguranca";
  if (entidade.startsWith("simulation")) return "simulacoes";
  if (entidade.startsWith("tax_profile")) return "perfis";
  return "outros";
}

export const Route = createFileRoute("/_authenticated/auditoria")({
  head: () => ({
    ...metaPagina({
      titulo: TITULO,
      descricao: DESCRICAO,
      caminho: "/auditoria",
    }),
  }),
  component: AuditoriaPage,
});

function AuditoriaPage() {
  const { isGrancontAdmin } = useApp();
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("todos");

  const logs = useQuery({
    queryKey: ["audit_logs"],
    enabled: isGrancontAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, entity, entity_id, action, actor_id, created_at, before_data, after_data")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const autores = useQuery({
    queryKey: ["audit_logs_autores", (logs.data ?? []).length],
    enabled: isGrancontAdmin && (logs.data ?? []).length > 0,
    queryFn: async () => {
      const ids = Array.from(
        new Set((logs.data ?? []).map((l) => l.actor_id).filter(Boolean) as string[]),
      );
      if (ids.length === 0) return {} as Record<string, string>;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      if (error) throw error;
      const mapa: Record<string, string> = {};
      for (const p of data ?? []) mapa[p.id] = p.full_name || p.email || p.id.slice(0, 8);
      return mapa;
    },
  });

  const eventos = useMemo(
    () =>
      (logs.data ?? []).filter((l) => filtro === "todos" || grupoDaEntidade(l.entity) === filtro),
    [logs.data, filtro],
  );

  if (!isGrancontAdmin) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-muted-foreground">
          A trilha de auditoria é restrita aos administradores Grancont.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Auditoria</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Últimos 200 eventos registrados em perfis tributários e em simulações (incluindo linhas de
        compra, tributos e despesas de venda), com autor, data e valores antes/depois.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <Button
            key={f.id}
            size="sm"
            variant={filtro === f.id ? "default" : "outline"}
            onClick={() => setFiltro(f.id)}
          >
            {f.rotulo}
          </Button>
        ))}
      </div>

      <section className="mt-6 space-y-2">
        {eventos.map((l) => (
          <details key={l.id} className="rounded-xl border border-border bg-card p-4">
            <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">{ACOES[l.action] ?? l.action}</Badge>
              <span className="font-medium text-foreground">{ROTULOS[l.entity] ?? l.entity}</span>
              <span className="text-xs text-muted-foreground">
                por {autores.data?.[l.actor_id ?? ""] ?? "sistema"}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(l.created_at).toLocaleString("pt-BR")}
              </span>
              <span className="text-xs text-muted-foreground">
                registro {l.entity_id?.slice(0, 8)}
              </span>
            </summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Antes</p>
                <pre className="mt-1 max-h-56 overflow-auto rounded bg-surface p-3 text-xs">
                  {JSON.stringify(l.before_data, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Depois</p>
                <pre className="mt-1 max-h-56 overflow-auto rounded bg-surface p-3 text-xs">
                  {JSON.stringify(l.after_data, null, 2)}
                </pre>
              </div>
            </div>
          </details>
        ))}
        {!logs.isLoading && eventos.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum evento registrado ainda.
          </p>
        ) : null}
      </section>
    </main>
  );
}
