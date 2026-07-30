import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
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
};

const ACOES: Record<string, string> = {
  insert: "criação",
  update: "alteração",
  delete: "exclusão",
};

const FILTROS = [
  { id: "todos", rotulo: "Todos" },
  { id: "simulacoes", rotulo: "Simulações" },
  { id: "perfis", rotulo: "Perfis tributários" },
] as const;

function grupoDaEntidade(entidade: string) {
  if (entidade.startsWith("simulation")) return "simulacoes";
  if (entidade.startsWith("tax_profile")) return "perfis";
  return "outros";
}

export const Route = createFileRoute("/_authenticated/auditoria")({
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
  component: AuditoriaPage,
});

function AuditoriaPage() {
  const { isGrancontAdmin } = useApp();

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
        Últimos 200 eventos registrados em perfis tributários e suas linhas.
      </p>

      <section className="mt-6 space-y-2">
        {(logs.data ?? []).map((l) => (
          <details key={l.id} className="rounded-xl border border-border bg-card p-4">
            <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">{l.action}</Badge>
              <span className="font-medium text-foreground">{l.entity}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(l.created_at).toLocaleString("pt-BR")}
              </span>
              <span className="text-xs text-muted-foreground">registro {l.entity_id?.slice(0, 8)}</span>
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
        {!logs.isLoading && (logs.data ?? []).length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum evento registrado ainda.
          </p>
        ) : null}
      </section>
    </main>
  );
}
