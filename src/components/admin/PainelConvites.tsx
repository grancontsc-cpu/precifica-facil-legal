import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApp } from "@/hooks/useApp";
import { supabase } from "@/integrations/supabase/client";
import { cancelarConvite, convidarUsuario, reenviarConvite } from "@/lib/admin.functions";

const ROTULO: Record<string, string> = {
  pending: "Pendente",
  accepted: "Aceito",
  cancelled: "Cancelado",
  expired: "Expirado",
};

export function PainelConvites({ escopoOrgId }: { escopoOrgId: string | null }) {
  const { isSuperAdmin, organizations, orgId } = useApp();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState<"manager" | "user">("user");
  const [empresa, setEmpresa] = useState<string>(escopoOrgId ?? orgId ?? "");
  const [ultimoLink, setUltimoLink] = useState<string | null>(null);

  const convites = useQuery({
    queryKey: ["admin", "convites", escopoOrgId],
    queryFn: async () => {
      let q = supabase
        .from("invitations")
        .select("id, email, full_name, intended_role, invitation_status, expires_at, created_at, organizations(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (escopoOrgId) q = q.eq("organization_id", escopoOrgId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidar = () => void qc.invalidateQueries({ queryKey: ["admin", "convites"] });

  const convidar = useMutation({
    mutationFn: async () =>
      convidarUsuario({
        data: {
          email: email.trim().toLowerCase(),
          fullName: nome.trim() || undefined,
          organizationId: escopoOrgId ?? empresa,
          role: papel,
        },
      }),
    onSuccess: async (r) => {
      setUltimoLink(r.link);
      setEmail("");
      setNome("");
      await navigator.clipboard.writeText(r.link).catch(() => undefined);
      toast.success("Convite criado. Link copiado para a área de transferência.");
      invalidar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível criar o convite."),
  });

  const reenviar = useMutation({
    mutationFn: (id: string) => reenviarConvite({ data: { id } }),
    onSuccess: async (r) => {
      setUltimoLink(r.link);
      await navigator.clipboard.writeText(r.link).catch(() => undefined);
      toast.success("Novo link gerado e copiado.");
      invalidar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível reenviar."),
  });

  const cancelar = useMutation({
    mutationFn: (id: string) => cancelarConvite({ data: { id } }),
    onSuccess: () => {
      toast.success("Convite cancelado.");
      invalidar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível cancelar."),
  });

  return (
    <section className="space-y-5">
      <form
        className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!(escopoOrgId ?? empresa)) return toast.error("Selecione a empresa.");
          convidar.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="c-email">E-mail</Label>
          <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-nome">Nome (opcional)</Label>
          <Input id="c-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        {!escopoOrgId ? (
          <div className="space-y-1.5">
            <Label>Empresa</Label>
            <Select value={empresa} onValueChange={setEmpresa}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label>Papel</Label>
          <Select value={papel} onValueChange={(v) => setPapel(v as "manager" | "user")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">Usuário</SelectItem>
              {isSuperAdmin ? <SelectItem value="manager">Gestor</SelectItem> : null}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <Button type="submit" disabled={convidar.isPending}>
            Enviar convite
          </Button>
        </div>
      </form>

      {ultimoLink ? (
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
          <span className="truncate text-muted-foreground">{ultimoLink}</span>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto shrink-0"
            onClick={() => {
              void navigator.clipboard.writeText(ultimoLink);
              toast.success("Link copiado.");
            }}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden /> Copiar
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Convidado</TableHead>
              <TableHead className="hidden md:table-cell">Empresa</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="hidden lg:table-cell">Expira em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(convites.data ?? []).map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="font-medium text-foreground">{c.full_name ?? c.email}</div>
                  <div className="text-xs text-muted-foreground">{c.email}</div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm">
                  {(c.organizations as { name: string } | null)?.name ?? "—"}
                </TableCell>
                <TableCell className="text-sm">{c.intended_role === "manager" ? "Gestor" : "Usuário"}</TableCell>
                <TableCell>
                  <Badge variant={c.invitation_status === "pending" ? "secondary" : "outline"}>
                    {ROTULO[c.invitation_status] ?? c.invitation_status}
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                  {new Date(c.expires_at).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell className="text-right">
                  {c.invitation_status === "pending" ? (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => reenviar.mutate(c.id)}>
                        Reenviar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => cancelar.mutate(c.id)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
            {!(convites.data ?? []).length ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  {convites.isLoading ? "Carregando convites…" : "Nenhum convite registrado."}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
