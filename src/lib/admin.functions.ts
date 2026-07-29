import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const emailSchema = z.string().trim().toLowerCase().email().max(255);
const uuid = z.string().uuid();

function origemDaRequisicao() {
  const origin = getRequestHeader("origin");
  if (origin) return origin;
  const host = getRequestHeader("host");
  return host ? `https://${host}` : "https://precifica-facil-legal.lovable.app";
}

export const convidarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: emailSchema,
        fullName: z.string().trim().max(120).optional(),
        organizationId: uuid,
        role: z.enum(["manager", "user"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const acesso = await import("./access.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ator = await acesso.carregarAtor(context.supabase, context.userId);

    acesso.exigirGestaoDe(ator, data.organizationId);
    if (data.role === "manager") acesso.exigirSuperAdmin(ator);

    const { data: empresa } = await supabaseAdmin
      .from("organizations")
      .select("id, name, active")
      .eq("id", data.organizationId)
      .maybeSingle();
    if (!empresa || !empresa.active) throw new Error("Empresa inexistente ou inativa.");

    const email = acesso.normalizarEmail(data.email);

    const { data: jaMembro } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (jaMembro) {
      const { data: vinculo } = await supabaseAdmin
        .from("organization_members")
        .select("id")
        .eq("user_id", jaMembro.id)
        .eq("organization_id", data.organizationId)
        .maybeSingle();
      if (vinculo) throw new Error("Este e-mail já está vinculado a esta empresa.");
    }

    await supabaseAdmin
      .from("invitations")
      .update({ invitation_status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("organization_id", data.organizationId)
      .eq("email", email)
      .eq("invitation_status", "pending");

    const { token, hash } = await acesso.gerarToken();
    const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: convite, error } = await supabaseAdmin
      .from("invitations")
      .insert({
        email,
        organization_id: data.organizationId,
        intended_role: data.role,
        full_name: data.fullName ?? null,
        token_hash: hash,
        invited_by: ator.userId,
        expires_at: expira,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await acesso.registrarAuditoria(supabaseAdmin, {
      organization_id: data.organizationId,
      actor_id: ator.userId,
      action: "convite_enviado",
      entity: "invitations",
      entity_id: convite.id,
      after_data: { email, role: data.role, expires_at: expira },
    });

    return { id: convite.id, link: `${origemDaRequisicao()}/aceitar-convite?token=${token}`, email };
  });

export const reenviarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const acesso = await import("./access.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ator = await acesso.carregarAtor(context.supabase, context.userId);

    const { data: convite } = await supabaseAdmin
      .from("invitations")
      .select("id, email, organization_id, intended_role, invitation_status")
      .eq("id", data.id)
      .maybeSingle();
    if (!convite) throw new Error("Convite não encontrado.");
    acesso.exigirGestaoDe(ator, convite.organization_id);
    if (convite.intended_role === "manager") acesso.exigirSuperAdmin(ator);
    if (convite.invitation_status !== "pending") throw new Error("Somente convites pendentes podem ser reenviados.");

    const { token, hash } = await acesso.gerarToken();
    const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from("invitations")
      .update({ token_hash: hash, expires_at: expira, updated_at: new Date().toISOString() })
      .eq("id", convite.id);

    await acesso.registrarAuditoria(supabaseAdmin, {
      organization_id: convite.organization_id,
      actor_id: ator.userId,
      action: "convite_reenviado",
      entity: "invitations",
      entity_id: convite.id,
      after_data: { email: convite.email, expires_at: expira },
    });

    return { link: `${origemDaRequisicao()}/aceitar-convite?token=${token}`, email: convite.email };
  });

export const cancelarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const acesso = await import("./access.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ator = await acesso.carregarAtor(context.supabase, context.userId);

    const { data: convite } = await supabaseAdmin
      .from("invitations")
      .select("id, organization_id, intended_role, invitation_status")
      .eq("id", data.id)
      .maybeSingle();
    if (!convite) throw new Error("Convite não encontrado.");
    acesso.exigirGestaoDe(ator, convite.organization_id);
    if (convite.intended_role === "manager") acesso.exigirSuperAdmin(ator);

    await supabaseAdmin
      .from("invitations")
      .update({ invitation_status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", convite.id);

    await acesso.registrarAuditoria(supabaseAdmin, {
      organization_id: convite.organization_id,
      actor_id: ator.userId,
      action: "convite_cancelado",
      entity: "invitations",
      entity_id: convite.id,
    });
    return { ok: true };
  });

const statusSchema = z.object({
  userId: uuid,
  organizationId: uuid.optional(),
});

export const alterarStatusUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    statusSchema
      .extend({
        status: z.enum(["active", "suspended", "rejected", "archived", "pending_approval"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const acesso = await import("./access.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ator = await acesso.carregarAtor(context.supabase, context.userId);

    if (data.userId === ator.userId) throw new Error("Você não pode alterar a própria situação.");
    await acesso.garantirAlvoPermitido(supabaseAdmin, ator, data.userId);

    if (!ator.isSuperAdmin) {
      const { data: vinculos } = await supabaseAdmin
        .from("organization_members")
        .select("organization_id, role")
        .eq("user_id", data.userId);
      const permitido = (vinculos ?? []).some(
        (v) => v.role === "user" && acesso.ehGestorDe(ator, v.organization_id),
      );
      if (!permitido) throw new Error("Você só pode alterar usuários comuns da sua empresa.");
    }

    const { data: antes } = await supabaseAdmin
      .from("profiles")
      .select("id, account_status")
      .eq("id", data.userId)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ account_status: data.status })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    if (data.status === "suspended" || data.status === "archived" || data.status === "rejected") {
      await supabaseAdmin.auth.admin.signOut(data.userId, "global").catch(() => undefined);
    }

    await acesso.registrarAuditoria(supabaseAdmin, {
      organization_id: data.organizationId ?? null,
      actor_id: ator.userId,
      action: `usuario_${data.status}`,
      entity: "profiles",
      entity_id: data.userId,
      before_data: antes,
      after_data: { account_status: data.status },
    });
    return { ok: true };
  });

export const alterarPapelMembro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: uuid, organizationId: uuid, role: z.enum(["manager", "user"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const acesso = await import("./access.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ator = await acesso.carregarAtor(context.supabase, context.userId);
    acesso.exigirSuperAdmin(ator);

    const { data: antes } = await supabaseAdmin
      .from("organization_members")
      .select("id, role")
      .eq("user_id", data.userId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (!antes) throw new Error("Vínculo não encontrado.");

    const { error } = await supabaseAdmin
      .from("organization_members")
      .update({ role: data.role, updated_at: new Date().toISOString() })
      .eq("id", antes.id);
    if (error) throw new Error(error.message);

    await acesso.registrarAuditoria(supabaseAdmin, {
      organization_id: data.organizationId,
      actor_id: ator.userId,
      action: "papel_alterado",
      entity: "organization_members",
      entity_id: antes.id,
      before_data: antes,
      after_data: { role: data.role },
    });
    return { ok: true };
  });

export const moverUsuarioDeEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ userId: uuid, deOrganizationId: uuid, paraOrganizationId: uuid, role: z.enum(["manager", "user"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const acesso = await import("./access.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ator = await acesso.carregarAtor(context.supabase, context.userId);
    acesso.exigirSuperAdmin(ator);

    await supabaseAdmin
      .from("organization_members")
      .delete()
      .eq("user_id", data.userId)
      .eq("organization_id", data.deOrganizationId);

    const { error } = await supabaseAdmin.from("organization_members").upsert(
      {
        user_id: data.userId,
        organization_id: data.paraOrganizationId,
        role: data.role,
        membership_status: "active",
        approved_by: ator.userId,
      },
      { onConflict: "organization_id,user_id" },
    );
    if (error) throw new Error(error.message);

    await acesso.registrarAuditoria(supabaseAdmin, {
      organization_id: data.paraOrganizationId,
      actor_id: ator.userId,
      action: "vinculo_alterado",
      entity: "organization_members",
      entity_id: data.userId,
      before_data: { organization_id: data.deOrganizationId },
      after_data: { organization_id: data.paraOrganizationId, role: data.role },
    });
    return { ok: true };
  });

export const enviarRecuperacaoSenha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ email: emailSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const acesso = await import("./access.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ator = await acesso.carregarAtor(context.supabase, context.userId);
    if (!ator.isSuperAdmin && ator.vinculos.every((v) => v.role !== "manager")) {
      throw new Error("Sem permissão.");
    }

    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
      options: { redirectTo: `${origemDaRequisicao()}/redefinir-senha` },
    });
    if (error) throw new Error("Não foi possível gerar a recuperação de senha.");

    await acesso.registrarAuditoria(supabaseAdmin, {
      actor_id: ator.userId,
      action: "recuperacao_senha_enviada",
      entity: "profiles",
      after_data: { email: data.email },
    });

    return { link: link?.properties?.action_link ?? null };
  });
