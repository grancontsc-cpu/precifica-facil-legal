import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { erro, ok, supabaseForUser } from "../supabase";

export default defineTool({
  name: "detalhar_simulacao",
  title: "Detalhar simulação",
  description:
    "Retorna uma simulação com as premissas e o resultado gravados (snapshots imutáveis), incluindo o perfil tributário usado.",
  inputSchema: {
    id: z.string().uuid().describe("ID da simulação."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) return erro("Não autenticado.");
    const supabase = supabaseForUser(ctx);

    const { data, error } = await supabase
      .from("simulations")
      .select(
        "id, titulo, produto_nome, quantidade, preco_final, custo_liquido_unitario, margem_efetiva, status, organization_id, tax_profile_name, tax_profile_version, calculation_version, calculated_at, input_snapshot, result_snapshot, tax_profile_snapshot",
      )
      .eq("id", id)
      .maybeSingle();

    if (error) return erro(error.message);
    if (!data) return erro("Simulação não encontrada ou sem permissão de acesso.");
    return ok(data);
  },
});
