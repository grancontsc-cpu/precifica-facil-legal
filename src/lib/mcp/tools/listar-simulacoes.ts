import { filtroIlike } from "./filtro-busca";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { erro, ok, supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_simulacoes",
  title: "Listar simulações",
  description:
    "Lista as simulações de precificação visíveis para o usuário conectado, com filtro por texto e status.",
  inputSchema: {
    busca: z.string().trim().optional().describe("Texto no título ou no nome do produto."),
    status: z
      .enum(["rascunho", "final", "arquivada"])
      .optional()
      .describe("Filtra pelo status da simulação."),
    limite: z.number().int().min(1).max(50).default(10).describe("Quantidade máxima de registros."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ busca, status, limite }, ctx) => {
    if (!ctx.isAuthenticated()) return erro("Não autenticado.");
    const supabase = supabaseForUser(ctx);

    let query = supabase
      .from("simulations")
      .select(
        "id, titulo, produto_nome, quantidade, preco_final, custo_liquido_unitario, margem_efetiva, status, organization_id, calculated_at, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(limite ?? 10);

    if (status) query = query.eq("status", status);
    if (busca) {
      const filtro = filtroIlike(["titulo", "produto_nome"], busca);
      if (filtro) query = query.or(filtro);
    }

    const { data, error } = await query;
    if (error) return erro(error.message);
    return ok({ total: data?.length ?? 0, simulacoes: data ?? [] });
  },
});
