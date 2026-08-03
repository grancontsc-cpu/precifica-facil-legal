import { filtroIlike } from "./filtro-busca";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { erro, ok, supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_produtos",
  title: "Listar produtos",
  description: "Lista os produtos cadastrados nas empresas visíveis para o usuário conectado.",
  inputSchema: {
    busca: z
      .string()
      .trim()
      .max(MAX_BUSCA, `A busca deve ter no máximo ${MAX_BUSCA} caracteres.`)
      .optional()
      .describe("Texto no nome, SKU ou NCM."),

    limite: z.number().int().min(1).max(50).default(20).describe("Quantidade máxima de registros."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ busca, limite }, ctx) => {
    if (!ctx.isAuthenticated()) return erro("Não autenticado.");
    const supabase = supabaseForUser(ctx);

    let query = supabase
      .from("products")
      .select("id, nome, sku, ncm, unidade, valor_unitario, organization_id, active, updated_at")
      .eq("active", true)
      .order("nome")
      .limit(limite ?? 20);

    if (busca) {
      const filtro = filtroIlike(["nome", "sku", "ncm"], busca);
      if (filtro) query = query.or(filtro);
    }

    const { data, error } = await query;
    if (error) return erro(error.message);
    return ok({ total: data?.length ?? 0, produtos: data ?? [] });
  },
});
