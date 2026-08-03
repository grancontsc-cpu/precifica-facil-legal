import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { metaPagina } from "@/lib/seo-head";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UFS, ufValida } from "@/lib/aliquotas";
import { REGIMES, nomeRegime } from "@/lib/pricing-engine";
import type { Regime } from "@/types/pricing";
import { useApp } from "@/hooks/useApp";
import { supabase } from "@/integrations/supabase/client";

const TITULO = "Empresas — Precifica Grancont";
const DESCRICAO = "Cadastro de empresas clientes, membros e perfil tributário padrão da Grancont.";

export const Route = createFileRoute("/_authenticated/empresas")({
  head: () => ({
    ...metaPagina({
      titulo: TITULO,
      descricao: DESCRICAO,
      caminho: "/empresas",
    }),
  }),
  component: EmpresasPage,
});

function EmpresasPage() {
  const { isGrancontAdmin, userId } = useApp();
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [uf, setUf] = useState("");
  const [regime, setRegime] = useState<Regime>("real");
  const [selecionada, setSelecionada] = useState<string | null>(null);

  const orgs = useQuery({
    queryKey: ["organizations", "admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, cnpj, uf, regime, active, default_tax_profile_id, created_at")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const perfis = useQuery({
    queryKey: ["tax_profiles", "todos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_profiles")
        .select("id, name, organization_id, version, active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const membros = useQuery({
    queryKey: ["members", selecionada],
    enabled: !!selecionada,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("id, user_id, role")
        .eq("organization_id", selecionada!);
      if (error) throw error;
      return data;
    },
  });

  const usuarios = useQuery({
    queryKey: ["profiles", "todos"],
    enabled: isGrancontAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("email");
      if (error) throw error;
      return data;
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) throw new Error("Informe o nome da empresa.");
      if (!cnpj.trim()) throw new Error("Informe o CNPJ da empresa.");
      if (!ufValida(uf)) throw new Error("Informe o estado (UF) da empresa.");
      const { error } = await supabase.from("organizations").insert({
        name: nome.trim(),
        cnpj: cnpj.trim(),
        uf,
        regime,
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNome("");
      setCnpj("");
      setUf("");
      setRegime("real");
      toast.success("Empresa cadastrada.");
      qc.invalidateQueries({ queryKey: ["organizations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const definirPerfilPadrao = useMutation({
    mutationFn: async ({ orgId, perfilId }: { orgId: string; perfilId: string | null }) => {
      const { error } = await supabase
        .from("organizations")
        .update({ default_tax_profile_id: perfilId })
        .eq("id", orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil tributário padrão atualizado.");
      qc.invalidateQueries({ queryKey: ["organizations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adicionarMembro = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: "manager" | "user" }) => {
      const { error } = await supabase
        .from("organization_members")
        .insert({ organization_id: selecionada!, user_id, role, membership_status: "active" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuário vinculado à empresa.");
      qc.invalidateQueries({ queryKey: ["members", selecionada] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removerMembro = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("organization_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", selecionada] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const [novoUsuario, setNovoUsuario] = useState<string>("");
  const [novoPapel, setNovoPapel] = useState<"manager" | "user">("user");

  if (!isGrancontAdmin) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-muted-foreground">
          Apenas administradores Grancont podem gerenciar empresas.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Empresas clientes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Cadastre clientes, vincule usuários e defina o perfil tributário padrão de cada empresa.
      </p>

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Nova empresa</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          O CNPJ, o estado e o regime são obrigatórios: é com eles que o simulador calcula o ICMS de
          fronteira e o tratamento dos créditos.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="org-nome">Nome</Label>
            <Input
              id="org-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-cnpj">CNPJ</Label>
            <Input
              id="org-cnpj"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              maxLength={20}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-uf">Estado (UF)</Label>
            <Select value={uf || undefined} onValueChange={setUf}>
              <SelectTrigger id="org-uf">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {UFS.map((u) => (
                  <SelectItem key={u.sigla} value={u.sigla}>
                    {u.sigla} — {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-regime">Regime tributário</Label>
            <Select value={regime} onValueChange={(v) => setRegime(v as Regime)}>
              <SelectTrigger id="org-regime">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIMES.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
              Cadastrar
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-6 space-y-3">
        {(orgs.data ?? []).map((o) => (
          <div key={o.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{o.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(o.cnpj ?? "sem CNPJ") +
                    " · " +
                    (o.uf ?? "UF não informada") +
                    " · " +
                    nomeRegime(o.regime as Regime)}
                </p>
              </div>
              <Badge variant={o.active ? "secondary" : "outline"}>
                {o.active ? "Ativa" : "Inativa"}
              </Badge>
              <Select
                value={o.default_tax_profile_id ?? "nenhum"}
                onValueChange={(v) =>
                  definirPerfilPadrao.mutate({ orgId: o.id, perfilId: v === "nenhum" ? null : v })
                }
              >
                <SelectTrigger className="h-9 w-[240px]">
                  <SelectValue placeholder="Perfil tributário padrão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Sem perfil padrão</SelectItem>
                  {(perfis.data ?? [])
                    .filter((p) => p.organization_id === null || p.organization_id === o.id)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} (v{p.version})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelecionada(selecionada === o.id ? null : o.id)}
              >
                {selecionada === o.id ? "Fechar" : "Usuários"}
              </Button>
            </div>

            {selecionada === o.id ? (
              <div className="mt-4 border-t border-border pt-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
                  <Select value={novoUsuario} onValueChange={setNovoUsuario}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione o usuário" />
                    </SelectTrigger>
                    <SelectContent>
                      {(usuarios.data ?? []).map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.email ?? u.full_name ?? u.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={novoPapel}
                    onValueChange={(v) => setNovoPapel(v as "manager" | "user")}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">Gestor da empresa</SelectItem>
                      <SelectItem value="user">Usuário</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() =>
                      novoUsuario &&
                      adicionarMembro.mutate({ user_id: novoUsuario, role: novoPapel })
                    }
                  >
                    Vincular
                  </Button>
                </div>

                <ul className="mt-4 space-y-2">
                  {(membros.data ?? []).map((m) => {
                    const p = (usuarios.data ?? []).find((u) => u.id === m.user_id);
                    return (
                      <li key={m.id} className="flex items-center gap-3 text-sm">
                        <span className="flex-1 truncate">
                          {p?.email ?? p?.full_name ?? m.user_id}
                        </span>
                        <Badge variant="outline">
                          {m.role === "manager" ? "Gestor" : "Usuário"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removerMembro.mutate(m.id)}
                        >
                          Remover
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        ))}
      </section>
    </main>
  );
}
