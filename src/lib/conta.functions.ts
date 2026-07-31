import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(200),
});

/**
 * Informa se um e-mail já possui conta no sistema.
 * Usado apenas para orientar o usuário no login/recuperação de senha
 * (mensagem "e-mail não cadastrado" + convite para criar conta).
 * Não devolve nenhum dado pessoal além da existência da conta.
 */
export const verificarEmailCadastrado = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => emailSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: perfil } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", data.email)
      .maybeSingle();
    return { cadastrado: !!perfil?.id };
  });

/**
 * Garante o provisionamento da conta após a confirmação do e-mail:
 * ativa o perfil, cria a licença de teste de 30 dias e, se o usuário ainda não
 * pertence a nenhuma empresa, cria a empresa dele com papel de gestor.
 * Toda a decisão acontece no servidor a partir da sessão verificada.
 */
export const provisionarConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: usuario } = await supabaseAdmin.auth.admin.getUserById(userId);
    const authUser = usuario?.user;
    if (!authUser) throw new Error("Sessão inválida.");

    const emailConfirmado = !!authUser.email_confirmed_at;
    const nome = (authUser.user_metadata?.full_name as string | undefined) ?? authUser.email ?? "Usuário";
    const nomeEmpresa =
      ((authUser.user_metadata?.company_name as string | undefined) ?? "").trim() || `Empresa de ${nome}`;

    // 1) Perfil
    const { data: perfil } = await supabaseAdmin
      .from("profiles")
      .select("id, account_status")
      .eq("id", userId)
      .maybeSingle();

    if (!perfil) {
      await supabaseAdmin.from("profiles").insert({
        id: userId,
        email: authUser.email,
        full_name: nome,
        account_status: emailConfirmado ? "active" : "pending_email_verification",
        email_verified_at: authUser.email_confirmed_at ?? null,
      });
    } else if (emailConfirmado && ["pending_email_verification", "invited"].includes(perfil.account_status)) {
      await supabaseAdmin
        .from("profiles")
        .update({ account_status: "active", email_verified_at: authUser.email_confirmed_at })
        .eq("id", userId);
    }

    if (!emailConfirmado) return { emailConfirmado: false as const };

    // 2) Licença de teste (30 dias) criada apenas uma vez
    const { data: licenca } = await supabaseAdmin
      .from("licenses")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!licenca) {
      const inicio = new Date();
      const fim = new Date(inicio.getTime() + 30 * 24 * 60 * 60 * 1000);
      await supabaseAdmin.from("licenses").insert({
        user_id: userId,
        status: "trial",
        plan: "free_trial",
        trial_started_at: inicio.toISOString(),
        trial_ends_at: fim.toISOString(),
      });
      await supabaseAdmin.from("audit_logs").insert({
        organization_id: null,
        actor_id: userId,
        action: "licenca_trial_iniciada",
        entity: "licenses",
        entity_id: userId,
        after_data: { status: "trial", trial_ends_at: fim.toISOString() },
      });
    }

    // 3) Empresa própria quando ainda não há vínculo
    const { data: vinculos } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId);

    if (!vinculos || vinculos.length === 0) {
      const { data: org, error: erroOrg } = await supabaseAdmin
        .from("organizations")
        .insert({ name: nomeEmpresa, created_by: userId })
        .select("id")
        .single();
      if (erroOrg || !org) throw new Error("Não foi possível criar a empresa da conta.");

      await supabaseAdmin.from("organization_members").insert({
        organization_id: org.id,
        user_id: userId,
        role: "manager",
        membership_status: "active",
      });

      await supabaseAdmin.from("audit_logs").insert({
        organization_id: org.id,
        actor_id: userId,
        action: "empresa_criada_no_cadastro",
        entity: "organizations",
        entity_id: org.id,
        after_data: { name: nomeEmpresa },
      });
    }

    return { emailConfirmado: true as const };
  });
