import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const onboardingSchema = z.object({
  nomeCompleto: z.string().trim().min(3, "Informe seu nome completo.").max(150),
  nomeEmpresa: z.string().trim().min(2, "Informe o nome da empresa.").max(150),
  cnpj: z.string().trim().max(20).optional(),
  uf: z.string().trim().length(2).optional(),
  cidade: z.string().trim().max(120).optional(),
  versaoTermos: z.string().trim().max(20).default("1.0"),
  versaoPrivacidade: z.string().trim().max(20).default("1.0"),
});

export type StatusOnboarding =
  | "criado"
  | "ja_concluido"
  | "vinculo_pendente"
  | "teste_ja_utilizado"
  | "super_admin"
  | "email_nao_confirmado"
  | "unauthenticated";

export interface ResultadoOnboarding {
  status: StatusOnboarding;
  organizationId: string | null;
  trialEndsAt: string | null;
}

/**
 * Conclui o cadastro do cliente após a confirmação do e-mail:
 * ativa o perfil, registra o aceite dos termos, vincula ou cria a empresa e
 * provisiona o teste gratuito de 30 dias (uma única vez por conta/e-mail/CNPJ).
 * Toda a regra roda no banco (complete_customer_onboarding) com a sessão do usuário.
 */
export const concluirOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => onboardingSchema.parse(input))
  .handler(async ({ data, context }): Promise<ResultadoOnboarding> => {
    const { data: retorno, error } = await context.supabase.rpc("complete_customer_onboarding", {
      p_full_name: data.nomeCompleto,
      p_company_name: data.nomeEmpresa,
      p_cnpj: data.cnpj || null,
      p_state: data.uf || null,
      p_city: data.cidade || null,
      p_terms_version: data.versaoTermos,
      p_privacy_version: data.versaoPrivacidade,
    });
    if (error) throw new Error("Não foi possível concluir o cadastro. Tente novamente.");

    const resultado = (retorno ?? {}) as {
      status?: StatusOnboarding;
      organization_id?: string;
      trial_ends_at?: string;
    };

    return {
      status: resultado.status ?? "unauthenticated",
      organizationId: resultado.organization_id ?? null,
      trialEndsAt: resultado.trial_ends_at ?? null,
    };
  });

/**
 * Situação atual da conta para decidir o destino após o login:
 * aplica o bloqueio automático por expiração antes de responder.
 */
export const situacaoOnboarding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { processarExpiracoes } = await import("@/lib/licencas.functions");
    void processarExpiracoes;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("process_expired_trials");

    const agora = new Date().toISOString();
    await supabaseAdmin
      .from("licenses")
      .update({ status: "expired" })
      .in("status", ["active", "courtesy"])
      .not("expires_at", "is", null)
      .lte("expires_at", agora);

    const [{ data: perfil }, { data: vinculos }, { data: licenca }, { data: pendencia }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("account_status, full_name, terms_accepted_at")
          .eq("id", context.userId)
          .maybeSingle(),
        supabaseAdmin
          .from("organization_members")
          .select("organization_id, role")
          .eq("user_id", context.userId)
          .eq("membership_status", "active"),
        supabaseAdmin
          .from("licenses")
          .select("status, plan, trial_started_at, trial_ends_at, activated_at, expires_at, notes")
          .eq("user_id", context.userId)
          .maybeSingle(),
        supabaseAdmin
          .from("organization_join_requests")
          .select("id")
          .eq("user_id", context.userId)
          .eq("status", "pending")
          .maybeSingle(),
      ]);

    return {
      contaStatus: perfil?.account_status ?? "pending_email_verification",
      precisaOnboarding: (vinculos ?? []).length === 0 && !pendencia,
      vinculoPendente: !!pendencia,
      organizacoes: vinculos ?? [],
      licenca: licenca ?? null,
    };
  });
