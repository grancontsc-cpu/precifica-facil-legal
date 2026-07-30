import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const eventoSchema = z.object({
  acao: z.enum(["carregar", "salvar", "duplicar", "arquivar", "criar"]),
  simulacaoId: z.string().uuid().nullable().optional(),
  organizationId: z.string().uuid().nullable().optional(),
  motivo: z.string().trim().max(500).default("Acesso negado."),
  origem: z.string().trim().max(120).optional(),
});

/**
 * Registra no log de auditoria uma tentativa NEGADA de carregar ou salvar
 * simulação detectada no frontend. A gravação usa o cliente administrativo
 * (o usuário não tem permissão para inserir auditoria em empresas às quais
 * não pertence), mas o ator vem sempre do token verificado — nunca do cliente.
 */
export const registrarAcessoNegado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => eventoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("audit_logs").insert({
      organization_id: data.organizationId ?? null,
      actor_id: context.userId,
      action: `acesso_negado_${data.acao}`,
      entity: "seguranca_simulacao",
      entity_id: data.simulacaoId ?? null,
      before_data: null,
      after_data: {
        usuario_id: context.userId,
        simulacao_id: data.simulacaoId ?? null,
        organizacao_id: data.organizationId ?? null,
        acao: data.acao,
        motivo: data.motivo,
        origem: data.origem ?? null,
        timestamp: new Date().toISOString(),
      } as never,
    });

    return { registrado: true as const };
  });
