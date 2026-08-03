// Helpers server-only para autorização administrativa.
// Nunca importe este arquivo de componentes ou rotas.
import type { SupabaseClient } from "@supabase/supabase-js";

export type PapelEmpresa = "manager" | "user";

export interface Ator {
  userId: string;
  email: string;
  isSuperAdmin: boolean;
  vinculos: { organization_id: string; role: PapelEmpresa }[];
}

/** Carrega o ator autenticado e garante que a conta esteja ativa. */
export async function carregarAtor(supabase: SupabaseClient, userId: string): Promise<Ator> {
  const { data: perfil } = await supabase
    .from("profiles")
    .select("id, email, account_status")
    .eq("id", userId)
    .maybeSingle();

  if (!perfil) throw new Error("Perfil não encontrado.");
  if (perfil.account_status !== "active") throw new Error("Sua conta não está ativa.");

  const { data: globais } = await supabase
    .from("global_user_roles")
    .select("role")
    .eq("user_id", userId);

  const { data: vinculos } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("membership_status", "active");

  return {
    userId,
    email: (perfil.email ?? "").toLowerCase(),
    isSuperAdmin: (globais ?? []).some((g) => g.role === "super_admin"),
    vinculos: (vinculos ?? []) as Ator["vinculos"],
  };
}

export function exigirSuperAdmin(ator: Ator) {
  if (!ator.isSuperAdmin) throw new Error("Apenas o Administrador Geral pode executar esta ação.");
}

export function ehGestorDe(ator: Ator, organizationId: string) {
  return ator.vinculos.some((v) => v.organization_id === organizationId && v.role === "manager");
}

export function exigirGestaoDe(ator: Ator, organizationId: string) {
  if (ator.isSuperAdmin) return;
  if (!ehGestorDe(ator, organizationId)) {
    throw new Error("Você não tem permissão sobre esta empresa.");
  }
}

export function normalizarEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Registra auditoria com o cliente administrativo (o usuário não pode forjar). */
export async function registrarAuditoria(
  admin: SupabaseClient,
  entrada: {
    organization_id?: string | null;
    actor_id: string;
    action: string;
    entity: string;
    entity_id?: string | null;
    before_data?: unknown;
    after_data?: unknown;
  },
) {
  await admin.from("audit_logs").insert({
    organization_id: entrada.organization_id ?? null,
    actor_id: entrada.actor_id,
    action: entrada.action,
    entity: entrada.entity,
    entity_id: entrada.entity_id ?? null,
    before_data: (entrada.before_data ?? null) as never,
    after_data: (entrada.after_data ?? null) as never,
  });
}

/** Impede que um gestor altere um Administrador Geral. */
export async function garantirAlvoPermitido(admin: SupabaseClient, ator: Ator, alvoUserId: string) {
  if (ator.isSuperAdmin) return;
  const { data } = await admin
    .from("global_user_roles")
    .select("user_id")
    .eq("user_id", alvoUserId)
    .maybeSingle();
  if (data) throw new Error("Você não pode alterar um Administrador Geral.");
}

export async function gerarToken(): Promise<{ token: string; hash: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return { token, hash: await hashToken(token) };
}

export async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
