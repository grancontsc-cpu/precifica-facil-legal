import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ArrowLeft, Trophy } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { linhasComparacao, type SimulacaoSalva } from "@/lib/comparar-simulacoes";
import { formatBRL, formatNumero, formatPercent } from "@/lib/format";
import { metaPagina } from "@/lib/seo-head";
import type { SimulationResult, SimulationState } from "@/types/pricing";

const TITULO = "Comparar simulações — Precifica Grancont";
const DESCRICAO =
  "Compare lado a lado simulações salvas de diferentes produtos, regimes e premissas tributárias.";

export const Route = createFileRoute("/_authenticated/comparar-simulacoes")({
  validateSearch: z.object({ ids: z.string().optional() }),
  head: () => ({
    ...metaPagina({ titulo: TITULO, descricao: DESCRICAO, caminho: "/comparar-simulacoes" }),
  }),
  component: CompararSimulacoes,
});

function CompararSimulacoes() {
  const { ids } = Route.useSearch();
  const lista = useMemo(
    () =>
      (ids ?? "")
        .split(",")
        .filter((i) => /^[0-9a-f-]{36}$/i.test(i))
        .slice(0, 4),
    [ids],
  );

  const consulta = useQuery({
    queryKey: ["simulations", "comparar", lista],
    enabled: lista.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simulations")
        .select(
          "id, titulo, produto_nome, tax_profile_name, tax_profile_version, input_snapshot, result_snapshot",
        )
        .in("id", lista);
      if (error) throw error;
      const porId = new Map((data ?? []).map((d) => [d.id, d]));
      return lista
        .map((id) => porId.get(id))
        .filter((d): d is NonNullable<typeof d> => !!d?.input_snapshot && !!d?.result_snapshot)
        .map<SimulacaoSalva>((d) => ({
          id: d.id,
          titulo: d.titulo,
          produto: d.produto_nome ?? "Produto avulso",
          perfil: d.tax_profile_name
            ? `${d.tax_profile_name}${d.tax_profile_version ? ` v${d.tax_profile_version}` : ""}`
            : "Configuração manual",
          state: d.input_snapshot as unknown as SimulationState,
          resultado: d.result_snapshot as unknown as SimulationResult,
        }));
    },
  });

  const sims = useMemo(() => consulta.data ?? [], [consulta.data]);
  const linhas = useMemo(() => linhasComparacao(sims), [sims]);
  const grupos = [...new Set(linhas.map((l) => l.grupo))];

  const fmt = (v: number | string | null, f: string) =>
    v === null
      ? "—"
      : typeof v === "string"
        ? v
        : f === "brl"
          ? formatBRL(v)
          : f === "pct"
            ? formatPercent(v)
            : formatNumero(v);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="mb-3">
        <Link to="/simulacoes">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" /> Voltar às simulações
        </Link>
      </Button>
      <h1 className="text-2xl font-semibold">Comparar simulações</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Valores das cópias salvas no momento de cada cálculo. O destaque indica o melhor resultado
        em cada linha.
      </p>

      {consulta.isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Carregando…</p>
      ) : sims.length < 2 ? (
        <p className="mt-6 rounded-lg border border-border bg-surface p-4 text-sm">
          Selecione ao menos duas simulações salvas na lista para comparar.
        </p>
      ) : (
        <section className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface text-left">
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 bg-surface px-4 py-3 text-xs uppercase text-muted-foreground"
                >
                  Item
                </th>
                {sims.map((s) => (
                  <th key={s.id} scope="col" className="px-4 py-3 text-right font-semibold">
                    <Link to="/simulador" search={{ simulacao: s.id }} className="hover:underline">
                      {s.titulo}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            {grupos.map((g) => (
              <tbody key={g}>
                <tr className="border-t border-border bg-surface/60">
                  <th
                    colSpan={sims.length + 1}
                    scope="colgroup"
                    className="px-4 py-2 text-left text-xs uppercase tracking-wide text-muted-foreground"
                  >
                    {g}
                  </th>
                </tr>
                {linhas
                  .filter((l) => l.grupo === g)
                  .map((l) => (
                    <tr key={l.rotulo} className="border-t border-border">
                      <th
                        scope="row"
                        className="sticky left-0 bg-card px-4 py-2 text-left font-normal text-muted-foreground"
                      >
                        {l.rotulo}
                      </th>
                      {l.valores.map((v, i) => (
                        <td
                          key={i}
                          className={`px-4 py-2 text-right tabular-nums ${l.melhor === i ? "font-semibold text-primary" : ""}`}
                        >
                          {l.melhor === i && (
                            <Trophy
                              className="mr-1 inline h-3.5 w-3.5"
                              aria-label="Melhor resultado"
                            />
                          )}
                          {fmt(v, l.formato)}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            ))}
          </table>
        </section>
      )}
    </main>
  );
}
