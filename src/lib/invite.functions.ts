import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().trim().length(64) });

/** Consulta pública de um convite pelo token (não expõe dados sensíveis). */
export const consultarConvite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    const { hashToken } = await import("./access.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const hash = await hashToken(data.token);
    const { data: convite } = await supabaseAdmin
      .from("invitations")
      .select(
        "id, email, intended_role, invitation_status, expires_at, full_name, organizations(name, active)",
      )
      .eq("token_hash", hash)
      .maybeSingle();

    if (!convite) return { valido: false as const, motivo: "Convite não encontrado." };
    if (convite.invitation_status === "accepted")
      return { valido: false as const, motivo: "Este convite já foi utilizado." };
    if (convite.invitation_status === "cancelled")
      return { valido: false as const, motivo: "Este convite foi cancelado." };
    if (new Date(convite.expires_at).getTime() < Date.now())
      return { valido: false as const, motivo: "Este convite expirou." };
    const empresa = convite.organizations as { name: string; active: boolean } | null;
    if (!empresa?.active)
      return { valido: false as const, motivo: "A empresa deste convite está inativa." };

    return {
      valido: true as const,
      email: convite.email,
      papel: convite.intended_role as "manager" | "user",
      empresa: empresa.name,
      nomeSugerido: convite.full_name ?? "",
    };
  });

/** Aceite do convite: cria a conta já confirmada e vincula à empresa. */
export const aceitarConvite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    tokenSchema
      .extend({
        fullName: z.string().trim().min(3).max(120),
        password: z.string().min(8).max(72),
        aceitouTermos: z.literal(true),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const acesso = await import("./access.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const hash = await acesso.hashToken(data.token);
    const { data: convite } = await supabaseAdmin
      .from("invitations")
      .select(
        "id, email, organization_id, intended_role, invitation_status, expires_at, invited_by",
      )
      .eq("token_hash", hash)
      .maybeSingle();

    if (!convite) throw new Error("Convite não encontrado.");
    if (convite.invitation_status !== "pending")
      throw new Error("Este convite não está mais disponível.");
    if (new Date(convite.expires_at).getTime() < Date.now()) {
      await supabaseAdmin
        .from("invitations")
        .update({ invitation_status: "expired" })
        .eq("id", convite.id);
      throw new Error("Este convite expirou.");
    }

    const { data: empresa } = await supabaseAdmin
      .from("organizations")
      .select("id, active")
      .eq("id", convite.organization_id)
      .maybeSingle();
    if (!empresa?.active) throw new Error("A empresa deste convite está inativa.");

    const email = acesso.normalizarEmail(convite.email);

    const { data: perfilExistente } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    let userId = perfilExistente?.id ?? null;

    if (!userId) {
      const { data: criado, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.fullName },
      });
      if (error || !criado.user)
        throw new Error("Não foi possível criar o acesso. Tente novamente.");
      userId = criado.user.id;
    } else {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
        email_confirm: true,
      });
    }

    await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email,
        full_name: data.fullName,
        account_status: "active",
        email_verified_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    const { error: erroVinculo } = await supabaseAdmin.from("organization_members").upsert(
      {
        organization_id: convite.organization_id,
        user_id: userId,
        role: convite.intended_role,
        membership_status: "active",
        invited_by: convite.invited_by,
        joined_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,user_id" },
    );
    if (erroVinculo) throw new Error(erroVinculo.message);

    await supabaseAdmin
      .from("invitations")
      .update({
        invitation_status: "accepted",
        accepted_at: new Date().toISOString(),
        token_hash: null,
      })
      .eq("id", convite.id);

    await acesso.registrarAuditoria(supabaseAdmin, {
      organization_id: convite.organization_id,
      actor_id: userId,
      action: "convite_aceito",
      entity: "invitations",
      entity_id: convite.id,
      after_data: { email, role: convite.intended_role },
    });

    return { email, papel: convite.intended_role as "manager" | "user" };
  });
