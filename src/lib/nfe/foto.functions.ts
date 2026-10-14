import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { NotaExtraida } from "./foto";

const entrada = z.object({
  imagem: z
    .string()
    .max(14_000_000)
    .regex(/^data:image\/(jpeg|png|webp|heic|heif);base64,/),
});

const trib = {
  type: "object",
  additionalProperties: false,
  required: ["cst", "aliquota", "valor"],
  properties: {
    cst: { type: ["string", "null"] },
    aliquota: { type: ["number", "null"] },
    valor: { type: ["number", "null"] },
  },
};
const num = { type: ["number", "null"] };
const str = { type: ["string", "null"] };
const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["legivel", "numero", "emissao", "emitenteNome", "emitenteCnpj", "emitenteUf", "destinatarioCnpj", "frete", "desconto", "seguro", "outras", "valorTotalNota", "itens"],
  properties: {
    legivel: { type: "boolean" },
    numero: str, emissao: str, emitenteNome: str, emitenteCnpj: str, emitenteUf: str, destinatarioCnpj: str,
    frete: num, desconto: num, seguro: num, outras: num, valorTotalNota: num,
    itens: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["descricao", "codigo", "ncm", "cfop", "unidade", "quantidade", "valorUnitario", "valorTotal", "icms", "ipi", "pis", "cofins", "icmsSt"],
        properties: {
          descricao: str, codigo: str, ncm: str, cfop: str, unidade: str,
          quantidade: num, valorUnitario: num, valorTotal: num,
          icms: trib, ipi: trib, pis: trib, cofins: trib, icmsSt: num,
        },
      },
    },
  },
};

const INSTRUCOES = `Você lê fotos de notas fiscais brasileiras (DANFE, NFC-e ou cupom) de compra.
Transcreva SOMENTE o que está impresso; nunca invente nem deduza alíquotas pelo NCM. Campo ausente ou ilegível = null.
Números em formato decimal com ponto (1.234,56 -> 1234.56). Alíquotas em porcentagem (18% -> 18).
Liste cada item da nota na ordem. Se a imagem não for uma nota fiscal ou estiver ilegível, legivel=false e itens=[].`;

/** Lê a foto de uma nota de compra com IA e devolve os campos para revisão. */
export const lerFotoNota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => entrada.parse(d))
  .handler(async ({ data }): Promise<{ dados: NotaExtraida | null; erro: string | null }> => {
    const chave = process.env.LOVABLE_API_KEY;
    if (!chave) return { dados: null, erro: "Leitura por foto indisponível no momento (configuração)." };

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
        reasoning: { effort: "low" },
        instructions: INSTRUCOES,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: "Extraia os dados desta nota fiscal de compra." },
              { type: "input_image", image_url: data.imagem },
            ],
          },
        ],
        text: { format: { type: "json_schema", name: "nota_fiscal", strict: true, schema: ESQUEMA } },
      }),
    });

    if (!resp.ok || !resp.body) {
      let msg = "";
      try {
        msg = ((await resp.json()) as { error?: { message?: string }; message?: string })?.error?.message ?? "";
      } catch {
        /* sem corpo */
      }
      if (resp.status === 429) return { dados: null, erro: "Muitas leituras ao mesmo tempo. Aguarde um minuto e tente de novo." };
      if (resp.status === 402) return { dados: null, erro: msg || "Os créditos de IA do escritório acabaram." };
      if (resp.status === 403) return { dados: null, erro: msg || "A leitura por IA está bloqueada para este espaço de trabalho." };
      return { dados: null, erro: "Não foi possível ler a foto agora. Tente novamente." };
    }

    const leitor = resp.body.getReader();
    const dec = new TextDecoder();
    let buffer = "";
    let texto = "";
    let falha = "";
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
          const ev = JSON.parse(json) as { type?: string; delta?: string; error?: { message?: string } };
          if (ev.type === "response.output_text.delta" && ev.delta) texto += ev.delta;
          else if (ev.type === "response.failed" || ev.type === "error") falha = ev.error?.message ?? "falha";
          else if (ev.type === "response.refusal.delta") falha = "recusa";
        } catch {
          /* linha parcial */
        }
      }
    }
    if (falha || !texto) return { dados: null, erro: "A IA não conseguiu ler esta foto. Tente outra imagem." };
    try {
      return { dados: JSON.parse(texto) as NotaExtraida, erro: null };
    } catch {
      return { dados: null, erro: "A leitura veio incompleta. Tente novamente." };
    }
  });
