import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { metaPagina } from "@/lib/seo-head";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useDebounce } from "@/hooks/useDebounce";
import { useMemo, useState } from "react";
import { toast } from "sonner";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/hooks/useApp";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";

const TITULO = "Produtos — Precifica Grancont";
const DESCRICAO = "Cadastro de produtos da empresa com SKU, NCM, unidade e valor unitário padrão.";

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({
    ...metaPagina({
      titulo: TITULO,
      descricao: DESCRICAO,
      caminho: "/produtos",
    }),
  }),
  component: ProdutosPage,
});

function ProdutosPage() {
  const { orgId, canEdit, userId } = useApp();
  const qc = useQueryClient();
  const [form, setForm] = useState({ nome: "", sku: "", ncm: "", unidade: "unidade", valor: "0" });
  const [busca, setBusca] = useState("");
  // Campo responde na hora; o filtro recalcula quando o usuário pausa a digitação.
  const buscaDebounce = useDebounce(busca, 300);


  const produtos = useQuery({
    queryKey: ["products", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, nome, sku, ncm, unidade, valor_unitario, active")
        .eq("organization_id", orgId!)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const lista = useMemo(() => {
    const termo = buscaDebounce.trim().toLowerCase();
    const todos = produtos.data ?? [];
    if (!termo) return todos;
    return todos.filter((p) =>
      `${p.nome} ${p.sku ?? ""} ${p.ncm ?? ""}`.toLowerCase().includes(termo),
    );
  }, [produtos.data, buscaDebounce]);


  const criar = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("Selecione uma empresa.");
      if (!form.nome.trim()) throw new Error("Informe o nome do produto.");
      const valor = Number(form.valor.replace(",", "."));
      if (!Number.isFinite(valor) || valor < 0) throw new Error("Valor unitário inválido.");
      const { error } = await supabase.from("products").insert({
        organization_id: orgId,
        nome: form.nome.trim(),
        sku: form.sku.trim() || null,
        ncm: form.ncm.trim() || null,
        unidade: form.unidade || "unidade",
        valor_unitario: valor,
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm({ nome: "", sku: "", ncm: "", unidade: "unidade", valor: "0" });
      toast.success("Produto cadastrado.");
      qc.invalidateQueries({ queryKey: ["products", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products", orgId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Produtos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Produtos disponíveis para simulação na empresa selecionada.
      </p>

      {canEdit ? (
        <section className="mt-6 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Novo produto</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="p-nome">Nome</Label>
              <Input id="p-nome" value={form.nome} maxLength={140} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-sku">SKU</Label>
              <Input id="p-sku" value={form.sku} maxLength={60} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-ncm">NCM</Label>
              <Input id="p-ncm" value={form.ncm} maxLength={20} onChange={(e) => setForm({ ...form, ncm: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-valor">Valor unitário</Label>
              <Input id="p-valor" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
              Cadastrar produto
            </Button>
          </div>
        </section>
      ) : (
        <p className="mt-6 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
          Seu perfil é apenas de consulta. O cadastro de produtos é feito pelo administrador da empresa.
        </p>
      )}

      <section className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">NCM</th>
              <th className="px-4 py-3">Unidade</th>
              <th className="px-4 py-3 text-right">Valor unitário</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium text-foreground">{p.nome}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.sku ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.ncm ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.unidade}</td>
                <td className="px-4 py-3 text-right">{formatBRL(Number(p.valor_unitario))}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to="/simulador"
                    search={{ produto: p.id }}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Simular
                  </Link>
                  {canEdit ? (
                    <Button variant="ghost" size="sm" onClick={() => remover.mutate(p.id)}>
                      Excluir
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
            {!produtos.isLoading && lista.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  {buscaDebounce.trim()
                    ? "Nenhum produto encontrado para esta busca."
                    : "Nenhum produto cadastrado ainda."}
                </td>
              </tr>

            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
