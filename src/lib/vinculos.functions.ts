import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PedidoVinculo {
  id: string;
  criadoEm: string;
  status: string;
  organizacaoId: string | null;
  organizacaoNome: string | null;
  cnpj: string | null;
  nomeInformado: string | null;
  solicitanteId: string;
  solicitanteNome: string | null;
  solicitanteEmail: string | null;
  tratadoEm: string | null;
}

/** Empresas em que o usuário atual pode aprovar vínculos (gestor) ou todas (Administrador Geral). */
async function escopoDeAprovacao(context: { supabase: unknown; userId: string }) {
  const supabase = context.supabase as {
    rpc: (fn: "is_super_admin") => Promise<{ data: unknown }>;
  };
  const { data: superAdmin } = await supabase.rpc("is_super_admin");
  if (superAdmin === true) return { superAdmin: true as const, orgIds: [] as string[] };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: vinculos } = await supabaseAdmin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", context.userId)
    .eq("membership_status", "active")
    .eq("role", "manager");

  const orgIds = (vinculos ?? []).map((v) => v.organization_id);
  if (orgIds.length === 0) throw new Error("Acesso restrito a gestores da empresa.");
  return { superAdmin: false as const, orgIds };
}

/** Lista os pedidos de vínculo (pendentes primeiro) visíveis para quem chamou. */
export const listarPedidosVinculo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PedidoVinculo[]> => {
    const escopo = await escopoDeAprovacao(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let consulta = supabaseAdmin
      .from("organization_join_requests")
      .select(
        "id, created_at, status, organization_id, normalized_cnpj, requested_name, user_id, reviewed_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (!escopo.superAdmin) consulta = consulta.in("organization_id", escopo.orgIds);

    const { data: pedidos, error } = await consulta;
    if (error) throw new Error("Não foi possível carregar os pedidos de vínculo.");

    const userIds = Array.from(new Set((pedidos ?? []).map((p) => p.user_id)));
    const orgIds = Array.from(
      new Set((pedidos ?? []).map((p) => p.organization_id).filter(Boolean) as string[]),
    );

    const [{ data: perfis }, { data: orgs }] = await Promise.all([
      userIds.length
        ? supabaseAdmin.from("profiles").select("id, full_name, email").in("id", userIds)
        : Promise.resolve({
            data: [] as { id: string; full_name: string | null; email: string | null }[],
          }),
      orgIds.length
        ? supabaseAdmin.from("organizations").select("id, name").in("id", orgIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

    const mapaPerfil = new Map((perfis ?? []).map((p) => [p.id, p]));
    const mapaOrg = new Map((orgs ?? []).map((o) => [o.id, o.name]));

    return (pedidos ?? []).map((p) => ({
      id: p.id,
      criadoEm: p.created_at,
      status: p.status,
      organizacaoId: p.organization_id,
      organizacaoNome: p.organization_id ? (mapaOrg.get(p.organization_id) ?? null) : null,
      cnpj: p.normalized_cnpj,
      nomeInformado: p.requested_name,
      solicitanteId: p.user_id,
      solicitanteNome: mapaPerfil.get(p.user_id)?.full_name ?? null,
      solicitanteEmail: mapaPerfil.get(p.user_id)?.email ?? null,
      tratadoEm: p.reviewed_at,
    }));
  });

const respostaSchema = z.object({
  pedidoId: z.string().uuid(),
  decisao: z.enum(["aprovar", "recusar"]),
  papel: z.enum(["user", "manager"]).default("user"),
  observacao: z.string().trim().max(500).optional(),
});

/**
 * Aprova ou recusa um pedido de vínculo. Ao aprovar, cria o vínculo ativo na
 * empresa; toda decisão fica registrada em auditoria.
 */
export const responderPedidoVinculo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => respostaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const escopo = await escopoDeAprovacao(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: pedido } = await supabaseAdmin
      .from("organization_join_requests")
      .select("id, user_id, organization_id, status")
      .eq("id", data.pedidoId)
      .maybeSingle();

    if (!pedido) throw new Error("Pedido não encontrado.");
    if (pedido.status !== "pending") throw new Error("Este pedido já foi respondido.");
    if (!pedido.organization_id) throw new Error("Pedido sem empresa vinculada.");
    if (!escopo.superAdmin && !escopo.orgIds.includes(pedido.organization_id))
      throw new Error("Você não pode responder pedidos de outra empresa.");

    if (data.decisao === "aprovar") {
      const { error: erroVinculo } = await supabaseAdmin.from("organization_members").upsert(
        {
          organization_id: pedido.organization_id,
          user_id: pedido.user_id,
          role: data.papel,
          membership_status: "active",
          approved_by: context.userId,
        },
        { onConflict: "organization_id,user_id" },
      );
      if (erroVinculo) throw new Error("Não foi possível criar o vínculo do usuário.");

      await supabaseAdmin
        .from("profiles")
        .update({ account_status: "active" })
        .eq("id", pedido.user_id)
        .in("account_status", ["pending_approval", "invited"]);
    }

    const { error } = await supabaseAdmin
      .from("organization_join_requests")
      .update({
        status: data.decisao === "aprovar" ? "approved" : "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
        review_notes: data.observacao ?? null,
      })
      .eq("id", pedido.id);
    if (error) throw new Error("Não foi possível registrar a decisão.");

    await supabaseAdmin.from("audit_logs").insert({
      organization_id: pedido.organization_id,
      actor_id: context.userId,
      action: data.decisao === "aprovar" ? "vinculo_aprovado" : "vinculo_recusado",
      entity: "organization_join_requests",
      entity_id: pedido.id,
      before_data: { status: "pending" } as never,
      after_data: {
        status: data.decisao === "aprovar" ? "approved" : "rejected",
        usuario_id: pedido.user_id,
        papel: data.decisao === "aprovar" ? data.papel : null,
        observacao: data.observacao ?? null,
        timestamp: new Date().toISOString(),
      } as never,
    });

    return { ok: true as const };
  });
