import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/hooks/useApp";
import { supabase } from "@/integrations/supabase/client";
import { comPendencias, resumoPorCliente, type SimulacaoCliente } from "@/lib/clientes";
import { metaPagina } from "@/lib/seo-head";
import type { SimulationState } from "@/types/pricing";

const TITULO = "Clientes e simulações — Precifica Grancont";
const DESCRICAO =
  "Acompanhe as simulações enviadas por cada cliente e revise as premissas antes da projeção da Reforma.";

export const Route = createFileRoute("/_authenticated/admin/clientes")({
  head: () => ({
    ...metaPagina({ titulo: TITULO, descricao: DESCRICAO, caminho: "/admin/clientes" }),
  }),
  component: Clientes,
});

const data = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

function Clientes() {
  const { organizations, isSuperAdmin } = useApp();
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [soPendentes, setSoPendentes] = useState(false);

  const consulta = useQuery({
    queryKey: ["clientes", "simulacoes"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data: sims, error } = await supabase
        .from("simulations")
        .select("id, organization_id, titulo, produto_nome, created_at, created_by, input_snapshot")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const autores = [...new Set((sims ?? []).map((s) => s.created_by).filter(Boolean))] as string[];
      const { data: perfis } = autores.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", autores)
        : { data: [] };
      const nome = new Map((perfis ?? []).map((p) => [p.id, p.full_name || p.email]));
      return comPendencias(
        (sims ?? []).map<SimulacaoCliente>((s) => ({
          id: s.id,
          organizationId: s.organization_id,
          titulo: s.titulo,
          produto: s.produto_nome,
          criadaEm: s.created_at,
          autor: s.created_by ? (nome.get(s.created_by) ?? null) : null,
          state: (s.input_snapshot as unknown as SimulationState) ?? null,
        })),
      );
    },
  });

  const sims = useMemo(() => consulta.data ?? [], [consulta.data]);
  const resumo = useMemo(() => resumoPorCliente(sims), [sims]);
  const clientes = organizations
    .filter((o) => o.name.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => (resumo.get(b.id)?.aRevisar ?? 0) - (resumo.get(a.id)?.aRevisar ?? 0));
  const atual = organizations.find((o) => o.id === selecionado) ?? null;
  const daEmpresa = sims.filter(
    (s) => s.organizationId === selecionado && (!soPendentes || s.pendencias > 0),
  );

  if (!isSuperAdmin)
    return <p className="p-6 text-sm">Esta tela é exclusiva do Administrador Geral.</p>;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold">Clientes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Veja o que cada cliente enviou e revise as premissas antes de apresentar a projeção.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <section aria-label="Lista de clientes" className="space-y-2">
          <Input
            placeholder="Buscar cliente"
            aria-label="Buscar cliente"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {consulta.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          <ul className="space-y-2">
            {clientes.map((o) => {
              const r = resumo.get(o.id);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => setSelecionado(o.id)}
                    aria-pressed={selecionado === o.id}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${selecionado === o.id ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-surface"}`}
                  >
                    <div className="font-medium">{o.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{r?.total ?? 0} simulações</span>
                      <span>· último envio {data(r?.ultimaEnvio ?? null)}</span>
                      {r?.aRevisar ? (
                        <Badge variant="destructive" className="text-[10px]">
                          {r.aRevisar} a revisar
                        </Badge>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-label="Simulações do cliente" className="rounded-xl border border-border bg-card p-4">
          {!atual ? (
            <p className="text-sm text-muted-foreground">Escolha um cliente para ver as simulações.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{atual.name}</h2>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={soPendentes}
                    onChange={(e) => setSoPendentes(e.target.checked)}
                  />
                  Só com premissas a revisar
                </label>
              </div>
              {daEmpresa.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Nenhuma simulação encontrada.</p>
              ) : (
                <ul className="mt-4 divide-y divide-border">
                  {daEmpresa.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <div className="font-medium">{s.titulo}</div>
                        <div className="text-xs text-muted-foreground">
                          {[s.produto ?? "Produto avulso", s.autor, data(s.criadaEm)]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {s.pendencias > 0 ? (
                          <span className="flex items-center gap-1 text-sm text-destructive">
                            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                            {s.pendencias} premissa{s.pendencias > 1 ? "s" : ""} a confirmar
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-sm text-primary">
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                            Premissas revisadas
                          </span>
                        )}
                        <Button asChild size="sm" variant={s.pendencias ? "default" : "outline"}>
                          <Link to="/simulador" search={{ simulacao: s.id }}>
                            {s.pendencias ? "Revisar premissas" : "Abrir"}
                          </Link>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
