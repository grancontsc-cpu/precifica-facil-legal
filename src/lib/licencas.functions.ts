import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const acaoSchema = z.object({
  userId: z.string().uuid(),
  acao: z.enum(["ativar", "suspender", "expirar", "estender_teste", "reiniciar_teste"]),
  dias: z.number().int().min(1).max(3650).optional(),
  validade: z.string().datetime().nullable().optional(),
  observacao: z.string().trim().max(500).optional(),
});

async function exigirSuperAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("global_user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!data) throw new Error("Ação permitida apenas ao Administrador Geral.");
  return supabaseAdmin;
}

/** Lista todas as licenças com dados do usuário (somente Administrador Geral). */
export const listarLicencas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await exigirSuperAdmin(context.userId);

    const [{ data: licencas }, { data: perfis }] = await Promise.all([
      supabaseAdmin.from("licenses").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("id, full_name, email, account_status, last_access_at"),
    ]);

    const mapa = new Map((perfis ?? []).map((p) => [p.id, p]));
    return (licencas ?? []).map((l) => ({
      ...l,
      full_name: mapa.get(l.user_id)?.full_name ?? null,
      email: mapa.get(l.user_id)?.email ?? null,
      account_status: mapa.get(l.user_id)?.account_status ?? null,
      last_access_at: mapa.get(l.user_id)?.last_access_at ?? null,
    }));
  });

/** Altera a licença de um usuário. Somente Administrador Geral, com auditoria. */
export const atualizarLicenca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => acaoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await exigirSuperAdmin(context.userId);

    const { data: atual } = await supabaseAdmin
      .from("licenses")
      .select("*")
      .eq("user_id", data.userId)
      .maybeSingle();

    const agora = new Date();
    const dias = data.dias ?? 30;
    const emDias = (n: number) => new Date(agora.getTime() + n * 24 * 60 * 60 * 1000).toISOString();

    let patch: Record<string, unknown> = {};
    if (data.acao === "ativar") {
      patch = {
        status: "active",
        plan: "licenciado",
        activated_at: agora.toISOString(),
        expires_at: data.validade ?? null,
      };
    } else if (data.acao === "suspender") {
      patch = { status: "suspended" };
    } else if (data.acao === "expirar") {
      patch = { status: "expired", expires_at: agora.toISOString() };
    } else if (data.acao === "estender_teste") {
      const base = atual?.trial_ends_at && new Date(atual.trial_ends_at) > agora ? new Date(atual.trial_ends_at) : agora;
      patch = {
        status: "trial",
        plan: "free_trial",
        trial_ends_at: new Date(base.getTime() + dias * 24 * 60 * 60 * 1000).toISOString(),
      };
    } else {
      patch = {
        status: "trial",
        plan: "free_trial",
        trial_started_at: agora.toISOString(),
        trial_ends_at: emDias(dias),
      };
    }

    patch.updated_by = context.userId;
    if (data.observacao !== undefined) patch.notes = data.observacao || null;

    const { error } = await supabaseAdmin
      .from("licenses")
      .upsert({ user_id: data.userId, ...patch }, { onConflict: "user_id" });
    if (error) throw new Error("Não foi possível atualizar a licença.");

    await supabaseAdmin.from("audit_logs").insert({
      organization_id: null,
      actor_id: context.userId,
      action: `licenca_${data.acao}`,
      entity: "licenses",
      entity_id: data.userId,
      before_data: atual ?? null,
      after_data: patch,
    });

    return { ok: true as const };
  });
