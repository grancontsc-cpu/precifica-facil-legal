import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { metaPagina } from "@/lib/seo-head";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CardTributoCompra } from "@/components/pricing/CardTributoCompra";
import { CardTributoVenda } from "@/components/pricing/CardTributoVenda";
import { useApp } from "@/hooks/useApp";
import { supabase } from "@/integrations/supabase/client";
import { tributosCompraPadrao, tributosVendaPadrao } from "@/lib/pricing-defaults";
import {
  aplicarPerfil,
  linhasDoEstado,
  type TaxProfileLineRow,
  type TaxProfileRow,
} from "@/lib/tax-profiles";
import { estadoInicial } from "@/lib/pricing-defaults";
import type { PurchaseTax, SaleTax, ScenarioId } from "@/types/pricing";

const TITULO = "Perfis tributários — Precifica Grancont";
const DESCRICAO =
  "Perfis tributários versionados por empresa ou globais, com vigência, cenário, alíquotas, tratamento no preço e direito a crédito.";

const CENARIOS: { id: ScenarioId; nome: string }[] = [
  { id: "atual", nome: "Atual" },
  { id: "transicao", nome: "Transição" },
  { id: "novo", nome: "Novo (IBS/CBS)" },
  { id: "personalizado", nome: "Personalizado" },
];

const CAMPOS_BLOQUEAVEIS = [
  { chave: "tributosCompra", rotulo: "Tributos da compra" },
  { chave: "tributosVenda", rotulo: "Tributos da venda" },
  { chave: "despesasVenda", rotulo: "Despesas de venda" },
  { chave: "margem", rotulo: "Margem desejada" },
];

export const Route = createFileRoute("/_authenticated/perfis")({
  head: () => ({
    ...metaPagina({
      titulo: TITULO,
      descricao: DESCRICAO,
      caminho: "/perfis",
    }),
  }),
  component: PerfisPage,
});

interface Rascunho {
  id: string | null;
  name: string;
  organization_id: string | null;
  scenario: ScenarioId;
  valid_from: string;
  valid_to: string;
  notes: string;
  active: boolean;
  version: number;
  locked_fields: string[];
  compra: PurchaseTax[];
  venda: SaleTax[];
}

function novoRascunho(orgId: string | null): Rascunho {
  return {
    id: null,
    name: "",
    organization_id: orgId,
    scenario: "atual",
    valid_from: new Date().toISOString().slice(0, 10),
    valid_to: "",
    notes: "",
    active: true,
    version: 1,
    locked_fields: [],
    compra: tributosCompraPadrao(),
    venda: tributosVendaPadrao(),
  };
}

function PerfisPage() {
  const { isGrancontAdmin, orgId, organizations } = useApp();
  const qc = useQueryClient();
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);

  const perfis = useQuery({
    queryKey: ["tax_profiles", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_profiles")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as unknown as TaxProfileRow[];
    },
  });

  const abrir = async (perfil: TaxProfileRow) => {
    const { data, error } = await supabase
      .from("tax_profile_lines")
      .select("*")
      .eq("tax_profile_id", perfil.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    const estado = aplicarPerfil(
      estadoInicial(),
      perfil,
      (data ?? []) as unknown as TaxProfileLineRow[],
    );
    setRascunho({
      id: perfil.id,
      name: perfil.name,
      organization_id: perfil.organization_id,
      scenario: perfil.scenario,
      valid_from: perfil.valid_from,
      valid_to: perfil.valid_to ?? "",
      notes: perfil.notes ?? "",
      active: perfil.active,
      version: perfil.version,
      locked_fields: Array.isArray(perfil.locked_fields) ? (perfil.locked_fields as string[]) : [],
      compra: estado.tributosCompra,
      venda: estado.tributosVenda,
    });
  };

  const salvar = useMutation({
    mutationFn: async (r: Rascunho) => {
      if (!r.name.trim()) throw new Error("Informe o nome do perfil tributário.");
      if (r.valid_to && r.valid_to < r.valid_from)
        throw new Error("Vigência final anterior à inicial.");
      const payload = {
        name: r.name.trim(),
        organization_id: r.organization_id,
        scenario: (r.scenario === "transicao2026" ? "transicao" : r.scenario) as
          "atual" | "transicao" | "novo" | "personalizado",
        valid_from: r.valid_from,
        valid_to: r.valid_to || null,
        notes: r.notes || null,
        active: r.active,
        locked_fields: r.locked_fields,
      };

      let perfilId = r.id;
      if (perfilId) {
        const { error } = await supabase
          .from("tax_profiles")
          .update({ ...payload, version: r.version + 1 })
          .eq("id", perfilId);
        if (error) throw error;
        const { error: delErr } = await supabase
          .from("tax_profile_lines")
          .delete()
          .eq("tax_profile_id", perfilId);
        if (delErr) throw delErr;
      } else {
        const { data, error } = await supabase
          .from("tax_profiles")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        perfilId = data.id;
      }

      const linhas = linhasDoEstado({
        ...estadoInicial(),
        tributosCompra: r.compra,
        tributosVenda: r.venda,
      }).map((l) => ({ ...l, tax_profile_id: perfilId! }));

      const { error: insErr } = await supabase.from("tax_profile_lines").insert(linhas);
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      toast.success("Perfil tributário salvo. Simulações antigas permanecem inalteradas.");
      setRascunho(null);
      qc.invalidateQueries({ queryKey: ["tax_profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isGrancontAdmin) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Perfis tributários</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estes são os perfis liberados pela Grancont para sua empresa. Apenas a Grancont pode
          alterá-los.
        </p>
        <ul className="mt-6 space-y-2">
          {(perfis.data ?? []).map((p) => (
            <li key={p.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{p.name}</span>
                <Badge variant="outline">v{p.version}</Badge>
                <Badge variant="secondary">{p.scenario}</Badge>
                <span className="text-xs text-muted-foreground">
                  Vigência: {p.valid_from} {p.valid_to ? `até ${p.valid_to}` : "(sem prazo final)"}
                </span>
              </div>
              {p.notes ? <p className="mt-2 text-sm text-muted-foreground">{p.notes}</p> : null}
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Perfis tributários
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Cada alteração gera uma nova versão e fica registrada na auditoria.
            </p>
          </div>
          <Button onClick={() => setRascunho(novoRascunho(orgId))}>Novo perfil</Button>
        </div>

        {rascunho ? (
          <section className="mt-6 rounded-xl border border-border bg-card p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5 lg:col-span-2">
                <Label htmlFor="tp-nome">Nome do perfil</Label>
                <Input
                  id="tp-nome"
                  value={rascunho.name}
                  maxLength={120}
                  onChange={(e) => setRascunho({ ...rascunho, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Empresa</Label>
                <Select
                  value={rascunho.organization_id ?? "global"}
                  onValueChange={(v) =>
                    setRascunho({ ...rascunho, organization_id: v === "global" ? null : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Perfil global (todas)</SelectItem>
                    {organizations.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cenário</Label>
                <Select
                  value={rascunho.scenario}
                  onValueChange={(v) => setRascunho({ ...rascunho, scenario: v as ScenarioId })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CENARIOS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tp-ini">Vigência inicial</Label>
                <Input
                  id="tp-ini"
                  type="date"
                  value={rascunho.valid_from}
                  onChange={(e) => setRascunho({ ...rascunho, valid_from: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tp-fim">Vigência final</Label>
                <Input
                  id="tp-fim"
                  type="date"
                  value={rascunho.valid_to}
                  onChange={(e) => setRascunho({ ...rascunho, valid_to: e.target.value })}
                />
              </div>
              <div className="flex items-end gap-2">
                <Switch
                  id="tp-ativo"
                  checked={rascunho.active}
                  onCheckedChange={(v) => setRascunho({ ...rascunho, active: v })}
                />
                <Label htmlFor="tp-ativo">Perfil ativo</Label>
              </div>
            </div>

            <div className="mt-4 space-y-1.5">
              <Label htmlFor="tp-obs">Observações</Label>
              <Textarea
                id="tp-obs"
                value={rascunho.notes}
                maxLength={1000}
                onChange={(e) => setRascunho({ ...rascunho, notes: e.target.value })}
              />
            </div>

            <div className="mt-4 rounded-lg border border-border bg-surface p-4">
              <p className="text-sm font-semibold text-foreground">
                Campos bloqueados para a empresa
              </p>
              <p className="text-xs text-muted-foreground">
                Os grupos marcados ficam somente leitura no simulador dos clientes.
              </p>
              <div className="mt-3 flex flex-wrap gap-4">
                {CAMPOS_BLOQUEAVEIS.map((c) => (
                  <label key={c.chave} className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={rascunho.locked_fields.includes(c.chave)}
                      onCheckedChange={(v) =>
                        setRascunho({
                          ...rascunho,
                          locked_fields: v
                            ? [...rascunho.locked_fields, c.chave]
                            : rascunho.locked_fields.filter((x) => x !== c.chave),
                        })
                      }
                    />
                    {c.rotulo}
                  </label>
                ))}
              </div>
            </div>

            <Tabs defaultValue="compra" className="mt-5">
              <TabsList>
                <TabsTrigger value="compra">Tributos da compra</TabsTrigger>
                <TabsTrigger value="venda">Tributos da venda</TabsTrigger>
              </TabsList>
              <TabsContent value="compra" className="mt-4 grid gap-3 md:grid-cols-2">
                {rascunho.compra.map((t) => (
                  <CardTributoCompra
                    key={t.id}
                    tributo={t}
                    avancado
                    onChange={(patch) =>
                      setRascunho({
                        ...rascunho,
                        compra: rascunho.compra.map((x) =>
                          x.id === t.id ? { ...x, ...patch } : x,
                        ),
                      })
                    }
                  />
                ))}
              </TabsContent>
              <TabsContent value="venda" className="mt-4 grid gap-3 md:grid-cols-2">
                {rascunho.venda.map((t) => (
                  <CardTributoVenda
                    key={t.id}
                    tributo={t}
                    avancado
                    onChange={(patch) =>
                      setRascunho({
                        ...rascunho,
                        venda: rascunho.venda.map((x) => (x.id === t.id ? { ...x, ...patch } : x)),
                      })
                    }
                  />
                ))}
              </TabsContent>
            </Tabs>

            <div className="mt-5 flex gap-2">
              <Button onClick={() => salvar.mutate(rascunho)} disabled={salvar.isPending}>
                Salvar perfil
              </Button>
              <Button variant="outline" onClick={() => setRascunho(null)}>
                Cancelar
              </Button>
            </div>
          </section>
        ) : null}

        <section className="mt-6 space-y-2">
          {(perfis.data ?? []).map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.organization_id
                    ? (organizations.find((o) => o.id === p.organization_id)?.name ?? "Empresa")
                    : "Perfil global"}{" "}
                  · vigência {p.valid_from} {p.valid_to ? `até ${p.valid_to}` : "(sem prazo final)"}
                </p>
              </div>
              <Badge variant="outline">v{p.version}</Badge>
              <Badge variant="secondary">{p.scenario}</Badge>
              <Badge variant={p.active ? "secondary" : "outline"}>
                {p.active ? "Ativo" : "Inativo"}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => void abrir(p)}>
                Editar
              </Button>
            </div>
          ))}
        </section>
      </main>
    </TooltipProvider>
  );
}
