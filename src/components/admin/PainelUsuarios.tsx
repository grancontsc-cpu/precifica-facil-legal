import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApp, type StatusConta } from "@/hooks/useApp";
import { supabase } from "@/integrations/supabase/client";
import {
  alterarPapelMembro,
  alterarStatusUsuario,
  enviarRecuperacaoSenha,
  moverUsuarioDeEmpresa,
} from "@/lib/admin.functions";

const ROTULO_STATUS: Record<string, string> = {
  invited: "Convidado",
  pending_email_verification: "E-mail não confirmado",
  pending_approval: "Aguardando aprovação",
  active: "Ativo",
  suspended: "Suspenso",
  rejected: "Recusado",
  archived: "Arquivado",
};

const VARIANTE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  suspended: "destructive",
  rejected: "destructive",
  archived: "outline",
};

interface Linha {
  id: string;
  full_name: string | null;
  email: string | null;
  account_status: string;
  last_access_at: string | null;
  created_at: string;
  role: "manager" | "user";
  organization_id: string;
  organizacao: string;
}

export function PainelUsuarios({ escopoOrgId }: { escopoOrgId: string | null }) {
  const { isSuperAdmin, organizations, userId } = useApp();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  const usuarios = useQuery({
    queryKey: ["admin", "usuarios", escopoOrgId, isSuperAdmin],
    queryFn: async () => {
      let q = supabase
        .from("organization_members")
        .select(
          "organization_id, role, organizations(name), profiles(id, full_name, email, account_status, last_access_at, created_at)",
        )
        .eq("membership_status", "active");
      if (escopoOrgId) q = q.eq("organization_id", escopoOrgId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? [])
        .filter((r) => !!(r as { profiles: unknown }).profiles)
        .map((r) => {
          const p = (r as unknown as { profiles: Omit<Linha, "role" | "organization_id" | "organizacao"> }).profiles;
          return {
            ...p,
            role: (r as unknown as { role: "manager" | "user" }).role,
            organization_id: (r as unknown as { organization_id: string }).organization_id,
            organizacao: (r as unknown as { organizations: { name: string } | null }).organizations?.name ?? "—",
          } as Linha;
        });
    },
  });

  const acao = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      toast.success("Alteração aplicada.");
      void qc.invalidateQueries({ queryKey: ["admin", "usuarios"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível concluir a ação."),
  });

  const lista = (usuarios.data ?? []).filter((u) => {
    const alvo = `${u.full_name ?? ""} ${u.email ?? ""} ${u.organizacao}`.toLowerCase();
    const okBusca = alvo.includes(busca.trim().toLowerCase());
    const okStatus = filtroStatus === "todos" || u.account_status === filtroStatus;
    return okBusca && okStatus;
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Buscar por nome, e-mail ou empresa"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Situação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as situações</SelectItem>
            {Object.entries(ROTULO_STATUS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground sm:ml-auto">{lista.length} usuário(s)</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead className="hidden md:table-cell">Empresa</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="hidden lg:table-cell">Último acesso</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.map((u) => (
              <TableRow key={`${u.id}-${u.organization_id}`}>
                <TableCell>
                  <div className="font-medium text-foreground">{u.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm">{u.organizacao}</TableCell>
                <TableCell>
                  {isSuperAdmin ? (
                    <Select
                      value={u.role}
                      onValueChange={(role) =>
                        acao.mutate(() =>
                          alterarPapelMembro({
                            data: { userId: u.id, organizationId: u.organization_id, role: role as "manager" | "user" },
                          }),
                        )
                      }
                    >
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manager">Gestor</SelectItem>
                        <SelectItem value="user">Usuário</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-sm">{u.role === "manager" ? "Gestor" : "Usuário"}</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={VARIANTE[u.account_status] ?? "secondary"}>
                    {ROTULO_STATUS[u.account_status] ?? u.account_status}
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                  {u.last_access_at ? new Date(u.last_access_at).toLocaleString("pt-BR") : "Nunca acessou"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-1">
                    {u.account_status === "active" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={u.id === userId}
                        onClick={() =>
                          acao.mutate(() =>
                            alterarStatusUsuario({
                              data: { userId: u.id, organizationId: u.organization_id, status: "suspended" },
                            }),
                          )
                        }
                      >
                        Suspender
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          acao.mutate(() =>
                            alterarStatusUsuario({
                              data: { userId: u.id, organizationId: u.organization_id, status: "active" },
                            }),
                          )
                        }
                      >
                        Reativar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        acao.mutate(async () => {
                          const r = await enviarRecuperacaoSenha({ data: { email: u.email ?? "" } });
                          if (r.link) await navigator.clipboard.writeText(r.link).catch(() => undefined);
                        })
                      }
                    >
                      Redefinir senha
                    </Button>
                    {isSuperAdmin && organizations.length > 1 ? (
                      <Select
                        value={u.organization_id}
                        onValueChange={(destino) =>
                          acao.mutate(() =>
                            moverUsuarioDeEmpresa({
                              data: {
                                userId: u.id,
                                deOrganizationId: u.organization_id,
                                paraOrganizationId: destino,
                                role: u.role,
                              },
                            }),
                          )
                        }
                      >
                        <SelectTrigger className="h-8 w-40">
                          <SelectValue placeholder="Mover empresa" />
                        </SelectTrigger>
                        <SelectContent>
                          {organizations.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!lista.length ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  {usuarios.isLoading ? "Carregando usuários…" : "Nenhum usuário encontrado."}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

export type { StatusConta };
