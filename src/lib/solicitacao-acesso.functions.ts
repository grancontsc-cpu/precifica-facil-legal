import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const solicitacaoSchema = z.object({
  simulacaoId: z.string().uuid().nullable().optional(),
  motivoCodigo: z.string().trim().max(60).default("sem_permissao_leitura"),
  mensagem: z.string().trim().min(10, "Descreva o motivo com pelo menos 10 caracteres.").max(1000),
  contato: z.string().trim().max(160).optional(),
});

/**
 * Registra um pedido de acesso a uma simulação e encaminha para a equipe
 * responsável (Administrador Geral e gestores da empresa dona do registro).
 *
 * O solicitante não tem permissão de leitura sobre a simulação, então a
 * empresa de destino é resolvida no servidor com o cliente administrativo.
 * Nenhum dado do registro volta para o cliente — apenas a confirmação.
 */
export const solicitarAcessoSimulacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => solicitacaoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let organizationId: string | null = null;
    if (data.simulacaoId) {
      const { data: sim } = await supabaseAdmin
        .from("simulations")
        .select("organization_id")
        .eq("id", data.simulacaoId)
        .maybeSingle();
      organizationId = sim?.organization_id ?? null;
    }

    // Evita duplicar pedidos pendentes iguais do mesmo usuário.
    const { data: pendente } = await supabaseAdmin
      .from("access_requests")
      .select("id")
      .eq("requester_id", context.userId)
      .eq("status", "pending")
      .eq("simulation_id", data.simulacaoId ?? "")
      .maybeSingle();

    if (pendente?.id) {
      return { registrado: true as const, duplicado: true as const };
    }

    const { error } = await supabaseAdmin.from("access_requests").insert({
      requester_id: context.userId,
      simulation_id: data.simulacaoId ?? null,
      organization_id: organizationId,
      reason_code: data.motivoCodigo,
      message: data.mensagem,
      contact: data.contato ?? null,
      status: "pending",
    });
    if (error) throw new Error("Não foi possível registrar a solicitação. Tente novamente.");

    await supabaseAdmin.from("audit_logs").insert({
      organization_id: organizationId,
      actor_id: context.userId,
      action: "solicitacao_acesso",
      entity: "seguranca_simulacao",
      entity_id: data.simulacaoId ?? null,
      before_data: null,
      after_data: {
        usuario_id: context.userId,
        simulacao_id: data.simulacaoId ?? null,
        motivo: data.motivoCodigo,
        mensagem: data.mensagem,
        contato: data.contato ?? null,
        timestamp: new Date().toISOString(),
      } as never,
    });

    return { registrado: true as const, duplicado: false as const };
  });
