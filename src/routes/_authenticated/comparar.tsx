import { useEffect, useMemo, useState } from "react";
import { metaPagina } from "@/lib/seo-head";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, RotateCcw, Sparkles } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CardFornecedor } from "@/components/comparar/CardFornecedor";
import { TabelaComparacao } from "@/components/comparar/TabelaComparacao";
import { DetalheComparacao } from "@/components/comparar/DetalheComparacao";
import { useApp } from "@/hooks/useApp";
import { supabase } from "@/integrations/supabase/client";
import { alternativaVazia, exemploComparacao } from "@/lib/comparison-defaults";
import { compararFornecedores } from "@/lib/supplier-comparison";
import { guardarComparacao } from "@/lib/comparison-storage";
import { MAX_ALTERNATIVAS, type SupplierAlternative } from "@/types/comparison";
import type { PurchaseTax } from "@/types/pricing";

const TITULO = "Comparar fornecedores — Precifica Grancont";
const DESCRICAO =
  "Compare até cinco alternativas de compra do mesmo produto por custo líquido real, considerando tributos, créditos recuperáveis, ICMS-ST, frete e prazo.";

export const Route = createFileRoute("/_authenticated/comparar")({
  head: () => ({
    ...metaPagina({
      titulo: TITULO,
      descricao: DESCRICAO,
      caminho: "/comparar",
    }),
  }),
  component: CompararPage,
});

function CompararPage() {
  const { orgId, canEdit } = useApp();
  const [produtoId, setProdutoId] = useState<string>("");
  const [alternativas, setAlternativas] = useState<SupplierAlternative[]>(() =>
    exemploComparacao(),
  );

  const produtos = useQuery({
    queryKey: ["products", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, nome, sku, unidade, valor_unitario")
        .eq("organization_id", orgId!)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const produto = produtos.data?.find((p) => p.id === produtoId) ?? null;

  const comparacao = useMemo(
    () => compararFornecedores(alternativas, produto?.nome ?? ""),
    [alternativas, produto?.nome],
  );

  useEffect(() => {
    guardarComparacao(produto?.nome ?? "", comparacao);
  }, [produto?.nome, comparacao]);

  const atualizar = (id: string, patch: Partial<SupplierAlternative>) =>
    setAlternativas((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const atualizarTributo = (id: string, tributoId: string, patch: Partial<PurchaseTax>) =>
    setAlternativas((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, tributos: a.tributos.map((t) => (t.id === tributoId ? { ...t, ...patch } : t)) }
          : a,
      ),
    );

  const adicionar = () => {
    if (alternativas.length >= MAX_ALTERNATIVAS) return;
    setAlternativas((prev) => [
      ...prev,
      alternativaVazia({
        valorUnitario: produto?.valor_unitario ?? 0,
        quantidade: prev[0]?.quantidade ?? 1,
      }),
    ]);
  };

  const aplicarProduto = (id: string) => {
    setProdutoId(id);
    const p = produtos.data?.find((x) => x.id === id);
    if (!p) return;
    setAlternativas((prev) =>
      prev.map((a) => (a.valorUnitario === 0 ? { ...a, valorUnitario: p.valor_unitario ?? 0 } : a)),
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Comparar fornecedores
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Compare até {MAX_ALTERNATIVAS} alternativas de compra do mesmo produto. O ranking usa o
            mesmo motor de cálculo do simulador: a decisão considera custo líquido depois dos
            créditos recuperáveis, e nunca apenas o preço nominal.
          </p>
        </header>

        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="min-w-[240px] space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Produto</Label>
            <Select value={produtoId || undefined} onValueChange={aplicarProduto}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Selecione um produto do catálogo" />
              </SelectTrigger>
              <SelectContent>
                {(produtos.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                    {p.sku ? ` · ${p.sku}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => setAlternativas(exemploComparacao())}>
            <Sparkles className="mr-2 h-4 w-4" aria-hidden /> Exemplo RJ x BA
          </Button>
          <Button
            variant="ghost"
            onClick={() => setAlternativas([alternativaVazia(), alternativaVazia()])}
          >
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden /> Limpar
          </Button>
          <Button
            className="ml-auto"
            onClick={adicionar}
            disabled={!canEdit || alternativas.length >= MAX_ALTERNATIVAS}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden /> Adicionar alternativa
          </Button>
        </div>

        {comparacao.avisos.map((a) => (
          <Alert key={a}>
            <AlertDescription>{a}</AlertDescription>
          </Alert>
        ))}

        <TabelaComparacao comparacao={comparacao} />

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {alternativas.map((a, i) => (
            <CardFornecedor
              key={a.id}
              alternativa={a}
              indice={i}
              linha={comparacao.linhas.find((l) => l.id === a.id)}
              podeRemover={alternativas.length > 1}
              somenteLeitura={!canEdit}
              onChange={(patch) => atualizar(a.id, patch)}
              onChangeTributo={(tid, patch) => atualizarTributo(a.id, tid, patch)}
              onRemove={() => setAlternativas((prev) => prev.filter((x) => x.id !== a.id))}
            />
          ))}
        </div>

        <DetalheComparacao comparacao={comparacao} />
      </div>
    </TooltipProvider>
  );
}
