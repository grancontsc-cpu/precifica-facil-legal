import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Áreas administrativas que podem ser solicitadas. */
export const AREAS_ADMIN = {
  painel_admin: "Painel do Administrador Geral",
  gestao_empresa: "Gestão da empresa",
} as const;

export type AreaAdmin = keyof typeof AREAS_ADMIN;

const pedidoSchema = z.object({
  area: z.enum(["painel_admin", "gestao_empresa"]),
  mensagem: z.string().trim().min(10, "Descreva o motivo com pelo menos 10 caracteres.").max(1000),
  contato: z.string().trim().max(160).optional(),
});

/**
 * Registra um pedido de acesso administrativo e encaminha para o
 * Administrador Geral. A identidade e o e-mail vêm da sessão verificada no
 * servidor — o cliente não consegue forjar o solicitante.
 */
export const solicitarAcessoAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => pedidoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: pendente } = await supabaseAdmin
      .from("access_requests")
      .select("id")
      .eq("requester_id", context.userId)
      .eq("status", "pending")
      .eq("requested_area", data.area)
      .is("simulation_id", null)
      .maybeSingle();

    if (pendente?.id) return { registrado: true as const, duplicado: true as const };

    const email = (context.claims as { email?: string } | null)?.email ?? null;

    const { error } = await supabaseAdmin.from("access_requests").insert({
      requester_id: context.userId,
      simulation_id: null,
      organization_id: null,
      requested_area: data.area,
      reason_code: "acesso_administrativo",
      message: data.mensagem,
      contact: data.contato || email,
      status: "pending",
    });
    if (error) throw new Error("Não foi possível registrar a solicitação. Tente novamente.");

    await supabaseAdmin.from("audit_logs").insert({
      organization_id: null,
      actor_id: context.userId,
      action: "solicitacao_acesso_admin",
      entity: "seguranca_admin",
      entity_id: null,
      before_data: null,
      after_data: {
        usuario_id: context.userId,
        email,
        area: data.area,
        mensagem: data.mensagem,
        contato: data.contato ?? null,
        timestamp: new Date().toISOString(),
      } as never,
    });

    return { registrado: true as const, duplicado: false as const };
  });

async function exigirSuperAdmin(supabase: { rpc: (fn: "is_super_admin") => Promise<{ data: unknown }> }) {
  const { data } = await supabase.rpc("is_super_admin");
  if (data !== true) throw new Error("Acesso restrito ao Administrador Geral.");
}

export interface SolicitacaoAdmin {
  id: string;
  criadoEm: string;
  status: string;
  area: string | null;
  motivo: string;
  contato: string | null;
  solicitanteNome: string | null;
  solicitanteEmail: string | null;
  tratadoEm: string | null;
  tratadoPor: string | null;
}

/** Lista os pedidos de acesso administrativo para o Administrador Geral. */
export const listarSolicitacoesAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SolicitacaoAdmin[]> => {
    await exigirSuperAdmin(context.supabase as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: pedidos, error } = await supabaseAdmin
      .from("access_requests")
      .select("id, created_at, status, requested_area, message, contact, requester_id, handled_at, handled_by")
      .is("simulation_id", null)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Não foi possível carregar as solicitações.");

    const ids = Array.from(
      new Set((pedidos ?? []).flatMap((p) => [p.requester_id, p.handled_by].filter(Boolean) as string[])),
    );
    const { data: perfis } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids)
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] };

    const mapa = new Map((perfis ?? []).map((p) => [p.id, p]));

    return (pedidos ?? []).map((p) => ({
      id: p.id,
      criadoEm: p.created_at,
      status: p.status,
      area: p.requested_area,
      motivo: p.message,
      contato: p.contact,
      solicitanteNome: mapa.get(p.requester_id)?.full_name ?? null,
      solicitanteEmail: mapa.get(p.requester_id)?.email ?? null,
      tratadoEm: p.handled_at,
      tratadoPor: p.handled_by ? (mapa.get(p.handled_by)?.full_name ?? null) : null,
    }));
  });

const decisaoSchema = z.object({
  id: z.string().uuid(),
  decisao: z.enum(["approved", "rejected"]),
});

/** Marca um pedido como tratado (aprovado ou recusado) e registra na auditoria. */
export const tratarSolicitacaoAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => decisaoSchema.parse(input))
  .handler(async ({ data, context }) => {
    await exigirSuperAdmin(context.supabase as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: antes } = await supabaseAdmin
      .from("access_requests")
      .select("id, status, requester_id, requested_area")
      .eq("id", data.id)
      .maybeSingle();
    if (!antes) throw new Error("Solicitação não encontrada.");

    const { error } = await supabaseAdmin
      .from("access_requests")
      .update({ status: data.decisao, handled_at: new Date().toISOString(), handled_by: context.userId })
      .eq("id", data.id);
    if (error) throw new Error("Não foi possível atualizar a solicitação.");

    await supabaseAdmin.from("audit_logs").insert({
      organization_id: null,
      actor_id: context.userId,
      action: "tratativa_solicitacao_acesso",
      entity: "access_requests",
      entity_id: data.id,
      before_data: { status: antes.status } as never,
      after_data: {
        status: data.decisao,
        solicitante_id: antes.requester_id,
        area: antes.requested_area,
        timestamp: new Date().toISOString(),
      } as never,
    });

    return { ok: true as const };
  });
