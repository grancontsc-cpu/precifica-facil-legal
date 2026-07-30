import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/hooks/useApp";
import {
  avaliarAcessoSimulacao,
  contextoDoApp,
  filtrarSimulacoesVisiveis,
  textoAcesso,
} from "@/lib/acesso-simulacao";
import { registrarNegativa } from "@/lib/registro-seguranca";
import { supabase } from "@/integrations/supabase/client";
import { ExportarSimulacao } from "@/components/report/ExportarSimulacao";
import type { SimulationResult, SimulationState } from "@/types/pricing";
import { formatBRL, formatPercent } from "@/lib/format";

const TITULO = "Histórico de simulações — Precifica Grancont";
const DESCRICAO =
  "Pesquise, duplique, recalcule e arquive simulações de precificação salvas por empresa.";

export const Route = createFileRoute("/_authenticated/simulacoes")({
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
  component: SimulacoesPage,
});

type Situacao = "ativas" | "arquivadas" | "todas";

function SimulacoesPage() {
  const { orgId, canEdit, userId, organizations, memberships, isSuperAdmin, accountStatus } = useApp();
  const nomeEmpresa = organizations?.find((o) => o.id === orgId)?.name ?? "Empresa";
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<Situacao>("ativas");

  const ctxAcesso = useMemo(
    () => contextoDoApp({ userId, accountStatus, isSuperAdmin, memberships }),
    [userId, accountStatus, isSuperAdmin, memberships],
  );

  const simulacoes = useQuery({
    queryKey: ["simulations", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simulations")
        .select(
          "id, titulo, produto_nome, status, created_at, updated_at, organization_id, created_by, preco_final, margem_efetiva, custo_liquido_unitario, quantidade, tax_profile_name, tax_profile_version, input_snapshot, result_snapshot, overridden_fields",
        )
        .eq("organization_id", orgId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    // Defesa em profundidade: além da RLS, filtra o que o usuário pode ver.
    const visiveis = filtrarSimulacoesVisiveis(
      ctxAcesso,
      (simulacoes.data ?? []).map((s) => ({
        ...s,
        organizationId: s.organization_id,
        createdBy: s.created_by,
      })),
    );
    return visiveis.filter((s) => {
      if (situacao === "ativas" && s.status === "arquivada") return false;
      if (situacao === "arquivadas" && s.status !== "arquivada") return false;
      if (!termo) return true;
      return `${s.titulo} ${s.produto_nome ?? ""} ${s.tax_profile_name ?? ""}`.toLowerCase().includes(termo);
    });
  }, [simulacoes.data, busca, situacao, ctxAcesso]);

  const podeAlterar = (s: { organization_id: string; created_by: string | null }) =>
    avaliarAcessoSimulacao(ctxAcesso, {
      organizationId: s.organization_id,
      createdBy: s.created_by,
    }).podeEscrever;

  const arquivar = useMutation({
    mutationFn: async ({
      id,
      archived,
      organizationId,
      createdBy,
    }: {
      id: string;
      archived: boolean;
      organizationId: string;
      createdBy: string | null;
    }) => {
      const acesso = avaliarAcessoSimulacao(ctxAcesso, { organizationId, createdBy });
      if (!acesso.podeEscrever) {
        const motivo = acesso.motivo ?? textoAcesso("sem_permissao_leitura");
        registrarNegativa({
          acao: "arquivar",
          simulacaoId: id,
          organizationId,
          motivo,
          origem: "historico",
        });
        throw new Error(motivo);
      }
      const { error } = await supabase
        .from("simulations")
        .update({ status: archived ? "arquivada" : "salva" })
        .eq("id", id)
        .eq("organization_id", organizationId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.archived ? "Simulação arquivada." : "Simulação reativada.");
      qc.invalidateQueries({ queryKey: ["simulations", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicar = useMutation({
    mutationFn: async ({
      id,
      organizationId,
      createdBy,
    }: {
      id: string;
      organizationId: string;
      createdBy: string | null;
    }) => {
      const acesso = avaliarAcessoSimulacao(ctxAcesso, { organizationId, createdBy });
      if (!acesso.podeEscrever) {
        const motivo = acesso.motivo ?? textoAcesso("sem_permissao_leitura");
        registrarNegativa({
          acao: "duplicar",
          simulacaoId: id,
          organizationId,
          motivo,
          origem: "historico",
        });
        throw new Error(motivo);
      }
      const { data, error } = await supabase
        .from("simulations")
        .select("*")
        .eq("id", id)
        .eq("organization_id", organizationId)
        .single();
      if (error) throw error;
      const copia = { ...(data as Record<string, unknown>) };
      delete copia.id;
      delete copia.created_at;
      delete copia.updated_at;
      copia.titulo = `${data.titulo} (cópia)`;
      copia.status = "salva";
      copia.created_by = userId;
      const { error: insErr } = await supabase.from("simulations").insert(copia as never);
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      toast.success("Simulação duplicada.");
      qc.invalidateQueries({ queryKey: ["simulations", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Toaster />
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Histórico de simulações</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Cada simulação guarda uma cópia imutável do perfil tributário usado no momento do cálculo.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Input
          placeholder="Pesquisar por nome, produto ou perfil"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-sm"
        />
        <Select value={situacao} onValueChange={(v) => setSituacao(v as Situacao)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativas">Ativas</SelectItem>
            <SelectItem value="arquivadas">Arquivadas</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <section className="mt-5 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Simulação</th>
              <th className="px-4 py-3">Perfil tributário</th>
              <th className="px-4 py-3 text-right">Custo líquido un.</th>
              <th className="px-4 py-3 text-right">Preço final</th>
              <th className="px-4 py-3 text-right">Margem</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {lista.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{s.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.produto_nome ?? "sem produto"} · {new Date(s.updated_at).toLocaleString("pt-BR")}
                    {s.status === "arquivada" ? " · arquivada" : ""}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline">
                    {s.tax_profile_name ?? "manual"}
                    {s.tax_profile_version ? ` v${s.tax_profile_version}` : ""}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">{formatBRL(Number(s.custo_liquido_unitario ?? 0))}</td>
                <td className="px-4 py-3 text-right font-medium">{formatBRL(Number(s.preco_final ?? 0))}</td>
                <td className="px-4 py-3 text-right">{formatPercent(Number(s.margem_efetiva ?? 0))}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate({ to: "/simulador", search: { simulacao: s.id } })}
                    >
                      Abrir
                    </Button>
                    {s.input_snapshot && s.result_snapshot ? (
                      <ExportarSimulacao
                        state={s.input_snapshot as unknown as SimulationState}
                        resultado={s.result_snapshot as unknown as SimulationResult}
                        meta={{
                          empresa: nomeEmpresa,
                          produto: s.produto_nome ?? "Produto avulso",
                          tituloSimulacao: s.titulo,
                          perfilTributario: s.tax_profile_name
                            ? `${s.tax_profile_name}${s.tax_profile_version ? ` (v${s.tax_profile_version})` : ""}`
                            : "Configuração manual",
                          dataSimulacao: new Date(s.updated_at),
                          camposAlterados: Array.isArray(s.overridden_fields)
                            ? (s.overridden_fields as string[])
                            : [],
                        }}
                      />
                    ) : null}
                    {podeAlterar(s) ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            duplicar.mutate({
                              id: s.id,
                              organizationId: s.organization_id,
                              createdBy: s.created_by,
                            })
                          }
                        >
                          Duplicar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            arquivar.mutate({
                              id: s.id,
                              archived: s.status !== "arquivada",
                              organizationId: s.organization_id,
                              createdBy: s.created_by,
                            })
                          }
                        >
                          {s.status === "arquivada" ? "Reativar" : "Arquivar"}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {!simulacoes.isLoading && lista.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhuma simulação encontrada.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
