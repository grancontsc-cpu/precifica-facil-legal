import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const entrada = z.object({
  pergunta: z.string().trim().min(3).max(1500),
  contexto: z.record(z.string(), z.unknown()),
  historico: z
    .array(z.object({ papel: z.enum(["contador", "assistente"]), texto: z.string().max(6000) }))
    .max(10),
});

const INSTRUCOES = `Você é o assistente de precificação do Precifica Grancont e responde a um contador brasileiro.
Use EXCLUSIVAMENTE os números do JSON "resultados calculados"; eles vêm do motor de cálculo e já estão corretos. Nunca recalcule alíquotas, nunca invente valores, nunca deduza tributação por NCM.
Explique os impactos ano a ano no lucro (2026 a 2033) em dois cenários: manter o preço de hoje (quanto o lucro e a margem caem) e manter o lucro em R$ (quanto o preço precisa subir).
Se a pergunta pedir algo que não está nos dados, diga isso claramente e sugira o que ajustar no simulador.
Responda em português, de forma objetiva, com valores em R$ no padrão brasileiro (R$ 1.234,56) e percentuais com vírgula. Use listas curtas quando ajudar. Trate como análise gerencial, não parecer fiscal.`;

/** Responde perguntas do contador sobre a simulação aberta. */
export const perguntarSobreSimulacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => entrada.parse(d))
  .handler(async ({ data }): Promise<{ resposta: string | null; erro: string | null }> => {
    const chave = process.env.LOVABLE_API_KEY;
    if (!chave) return { resposta: null, erro: "Assistente indisponível no momento (configuração)." };

    const historico = data.historico.map((m) => ({
      role: m.papel === "contador" ? "user" : "assistant",
      content: m.texto,
    }));

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${chave}`,
        "Lovable-API-Key": chave,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "medium" },
        instructions: INSTRUCOES,
        input: [
          {
            role: "user",
            content: `Resultados calculados da simulação aberta (JSON):\n${JSON.stringify(data.contexto)}`,
          },
          ...historico,
          { role: "user", content: data.pergunta },
        ],
      }),
    });

    if (!resp.ok || !resp.body) {
      let msg = "";
      try {
        msg =
          ((await resp.json()) as { error?: { message?: string } })?.error?.message ?? "";
      } catch {
        /* sem corpo */
      }
      if (resp.status === 429)
        return { resposta: null, erro: "Muitas perguntas ao mesmo tempo. Aguarde um minuto." };
      if (resp.status === 402)
        return { resposta: null, erro: msg || "Os créditos de IA do escritório acabaram." };
      if (resp.status === 403)
        return { resposta: null, erro: msg || "O assistente está bloqueado para este espaço de trabalho." };
      return { resposta: null, erro: "Não foi possível responder agora. Tente novamente." };
    }

    const leitor = resp.body.getReader();
    const dec = new TextDecoder();
    let buffer = "";
    let texto = "";
    let falha = false;
    for (;;) {
      const { value, done } = await leitor.read();
      if (done) break;
      buffer += dec.decode(value, { stream: true });
      let fim;
      while ((fim = buffer.indexOf("\n")) >= 0) {
        const linha = buffer.slice(0, fim).trim();
        buffer = buffer.slice(fim + 1);
        if (!linha.startsWith("data:")) continue;
        const json = linha.slice(5).trim();
        if (!json || json === "[DONE]") continue;
        try {
          const ev = JSON.parse(json) as { type?: string; delta?: string };
          if (ev.type === "response.output_text.delta" && ev.delta) texto += ev.delta;
          else if (ev.type === "response.failed" || ev.type === "error" || ev.type === "response.refusal.delta")
            falha = true;
        } catch {
          /* linha parcial */
        }
      }
    }
    if (falha || !texto.trim())
      return { resposta: null, erro: "O assistente não conseguiu responder esta pergunta." };
    return { resposta: texto.trim(), erro: null };
  });
