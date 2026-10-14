import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Ações de ciclo de vida da licença disponíveis ao Administrador Geral. */
export const ACOES_LICENCA = [
  "ativar",
  "estender",
  "suspender",
  "reativar",
  "cancelar",
  "reiniciar_teste",
] as const;

export type AcaoLicenca = (typeof ACOES_LICENCA)[number];

const acaoSchema = z.object({
  userId: z.string().uuid(),
  acao: z.enum(ACOES_LICENCA),
  dias: z.number().int().min(1).max(3650).optional(),
  validade: z.string().datetime().nullable().optional(),
  observacao: z.string().trim().max(500).optional(),
});

const DIA = 24 * 60 * 60 * 1000;
const emDias = (base: Date, n: number) => new Date(base.getTime() + n * DIA).toISOString();

type ClienteAdmin = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function exigirSuperAdmin(userId: string): Promise<ClienteAdmin> {
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

async function registrarEvento(
  supabaseAdmin: ClienteAdmin,
  params: {
    licenseId: string | null;
    organizationId: string | null;
    tipo: string;
    statusAnterior: string | null;
    statusNovo: string | null;
    validadeAnterior: string | null;
    validadeNova: string | null;
    atorId: string | null;
    motivo: string | null;
  },
) {
  const { error } = await supabaseAdmin.from("license_events").insert({
    license_id: params.licenseId,
    organization_id: params.organizationId,
    event_type: params.tipo,
    previous_status: params.statusAnterior,
    new_status: params.statusNovo,
    previous_expiration: params.validadeAnterior,
    new_expiration: params.validadeNova,
    actor_user_id: params.atorId,
    reason: params.motivo,
  });
  if (error) throw new Error("Não foi possível registrar o evento da licença.");
}

/** Data de término efetiva conforme o status atual da licença. */
function validadeAtual(licenca: {
  status: string;
  expires_at: string | null;
  trial_ends_at: string | null;
}) {
  return licenca.status === "trial" ? licenca.trial_ends_at : licenca.expires_at;
}

/**
 * Bloqueio automático por expiração.
 * Encerra testes vencidos (rotina do banco) e marca como expiradas as licenças
 * ativas/cortesia cuja validade já passou, sempre com registro em license_events.
 */
async function aplicarExpiracoes(supabaseAdmin: ClienteAdmin) {
  await supabaseAdmin.rpc("process_expired_trials");

  const agora = new Date().toISOString();
  const { data: vencidas } = await supabaseAdmin
    .from("licenses")
    .select("id, organization_id, status, expires_at")
    .in("status", ["active", "courtesy"])
    .not("expires_at", "is", null)
    .lte("expires_at", agora);

  for (const licenca of vencidas ?? []) {
    const { error } = await supabaseAdmin
      .from("licenses")
      .update({ status: "expired" })
      .eq("id", licenca.id)
      .in("status", ["active", "courtesy"]);
    if (error) continue;

    await registrarEvento(supabaseAdmin, {
      licenseId: licenca.id,
      organizationId: licenca.organization_id,
      tipo: "license_expired",
      statusAnterior: licenca.status,
      statusNovo: "expired",
      validadeAnterior: licenca.expires_at,
      validadeNova: licenca.expires_at,
      atorId: null,
      motivo: "Bloqueio automático por vencimento da licença",
    });
  }

  return { expiradas: (vencidas ?? []).length };
}

/** Roda o bloqueio automático por expiração (testes e licenças vencidas). */
export const processarExpiracoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Qualquer usuário autenticado pode disparar a rotina: ela apenas aplica
    // vencimentos já definidos, nunca concede acesso.
    void context.userId;
    return aplicarExpiracoes(supabaseAdmin);
  });

/** Lista todas as licenças com dados do usuário (somente Administrador Geral). */
export const listarLicencas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await exigirSuperAdmin(context.userId);
    await aplicarExpiracoes(supabaseAdmin);

    const [{ data: licencas }, { data: perfis }] = await Promise.all([
      supabaseAdmin.from("licenses").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("id, full_name, email, account_status, last_access_at"),
    ]);

    const mapa = new Map((perfis ?? []).map((p) => [p.id, p]));
    return (licencas ?? [])
      .filter((l) => !!l.user_id)
      .map((l) => {
        const uid = l.user_id as string;
        return {
          ...l,
          user_id: uid,
          full_name: mapa.get(uid)?.full_name ?? null,
          email: mapa.get(uid)?.email ?? null,
          account_status: mapa.get(uid)?.account_status ?? null,
          last_access_at: mapa.get(uid)?.last_access_at ?? null,
        };
      });
  });

/** Histórico de eventos de uma licença (somente Administrador Geral). */
export const listarEventosLicenca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await exigirSuperAdmin(context.userId);
    const { data: licenca } = await supabaseAdmin
      .from("licenses")
      .select("id")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (!licenca) return [];

    const { data: eventos } = await supabaseAdmin
      .from("license_events")
      .select("*")
      .eq("license_id", licenca.id)
      .order("created_at", { ascending: false })
      .limit(100);
    return eventos ?? [];
  });

/**
 * Executa uma ação de ciclo de vida na licença de um usuário.
 * Somente Administrador Geral. Toda mudança gera evento em license_events
 * e registro em audit_logs com antes/depois.
 */
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
    const statusAnterior = atual?.status ?? null;
    const validadeAnterior = atual ? validadeAtual(atual) : null;

    let patch: Record<string, unknown> = {};
    let evento = "";

    if (data.acao === "ativar") {
      patch = {
        status: "active",
        plan: "licenciado",
        activated_at: agora.toISOString(),
        activated_by: context.userId,
        starts_at: agora.toISOString(),
        expires_at: data.validade ?? (data.dias ? emDias(agora, dias) : null),
        suspended_at: null,
        suspended_by: null,
        suspension_reason: null,
      };
      evento = "license_activated";
    } else if (data.acao === "estender") {
      if (atual?.status === "trial") {
        const base =
          atual.trial_ends_at && new Date(atual.trial_ends_at) > agora
            ? new Date(atual.trial_ends_at)
            : agora;
        patch = { status: "trial", plan: "free_trial", trial_ends_at: emDias(base, dias) };
      } else {
        const base =
          atual?.expires_at && new Date(atual.expires_at) > agora
            ? new Date(atual.expires_at)
            : agora;
        patch = {
          status: "active",
          expires_at: emDias(base, dias),
          suspended_at: null,
          suspended_by: null,
          suspension_reason: null,
        };
      }
      evento = "license_extended";
    } else if (data.acao === "suspender") {
      patch = {
        status: "suspended",
        suspended_at: agora.toISOString(),
        suspended_by: context.userId,
        suspension_reason: data.observacao || null,
      };
      evento = "license_suspended";
    } else if (data.acao === "reativar") {
      const testeValido =
        !!atual?.trial_ends_at && new Date(atual.trial_ends_at).getTime() > agora.getTime();
      const validade = data.validade ?? atual?.expires_at ?? null;
      const validadeFutura = !validade || new Date(validade).getTime() > agora.getTime();

      patch =
        testeValido && !data.validade
          ? {
              status: "trial",
              plan: "free_trial",
              suspended_at: null,
              suspended_by: null,
              suspension_reason: null,
            }
          : {
              status: "active",
              plan: atual?.plan === "free_trial" ? "licenciado" : (atual?.plan ?? "licenciado"),
              activated_at: atual?.activated_at ?? agora.toISOString(),
              activated_by: atual?.activated_by ?? context.userId,
              expires_at: validadeFutura ? validade : emDias(agora, dias),
              suspended_at: null,
              suspended_by: null,
              suspension_reason: null,
            };
      evento = "license_reactivated";
    } else if (data.acao === "cancelar") {
      patch = {
        status: "canceled",
        expires_at: agora.toISOString(),
        suspension_reason: data.observacao || null,
      };
      evento = "license_canceled";
    } else {
      patch = {
        status: "trial",
        plan: "free_trial",
        trial_started_at: agora.toISOString(),
        trial_ends_at: emDias(agora, dias),
        suspended_at: null,
        suspended_by: null,
        suspension_reason: null,
      };
      evento = "trial_restarted";
    }

    patch.updated_by = context.userId;
    if (data.observacao !== undefined && data.acao !== "suspender" && data.acao !== "cancelar") {
      patch.notes = data.observacao || null;
    }

    // O índice único de user_id é parcial, então o upsert com onConflict não
    // funciona no Postgres: atualiza quando existe, insere quando não existe.
    const { data: salva, error } = atual
      ? await supabaseAdmin
          .from("licenses")
          .update(patch as never)
          .eq("id", atual.id)
          .select("*")
          .single()
      : await supabaseAdmin
          .from("licenses")
          .insert({ user_id: data.userId, ...patch } as never)
          .select("*")
          .single();
    if (error || !salva) throw new Error("Não foi possível atualizar a licença.");

    await registrarEvento(supabaseAdmin, {
      licenseId: salva.id,
      organizationId: salva.organization_id,
      tipo: evento,
      statusAnterior,
      statusNovo: salva.status,
      validadeAnterior,
      validadeNova: validadeAtual(salva),
      atorId: context.userId,
      motivo: data.observacao || null,
    });

    await supabaseAdmin.from("audit_logs").insert({
      organization_id: salva.organization_id,
      actor_id: context.userId,
      action: `licenca_${data.acao}`,
      entity: "licenses",
      entity_id: salva.id,
      before_data: atual ?? null,
      after_data: salva as unknown as Record<string, never>,
    });

    return { ok: true as const, status: salva.status, evento };
  });
