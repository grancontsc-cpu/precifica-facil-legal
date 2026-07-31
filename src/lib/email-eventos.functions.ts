import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Tipos de evento de e-mail registrados em `email_events`.
 * Cobrem todo o ciclo: confirmação de conta, criação de senha e recuperação.
 */
export const TIPOS_EVENTO_EMAIL = [
  "cadastro_solicitado",
  "confirmacao_enviada",
  "confirmacao_reenviada",
  "confirmacao_concluida",
  "recuperacao_solicitada",
  "senha_criada",
  "senha_redefinida",
] as const;

export type TipoEventoEmail = (typeof TIPOS_EVENTO_EMAIL)[number];

const schema = z.object({
  tipo: z.enum(TIPOS_EVENTO_EMAIL),
  email: z.string().trim().toLowerCase().max(200).optional(),
  status: z.enum(["ok", "erro", "ignorado"]).default("ok"),
  codigoErro: z.string().trim().max(80).optional(),
  mensagemErro: z.string().trim().max(300).optional(),
  referencia: z.string().trim().max(120).optional(),
});

/**
 * Registra um evento do fluxo de e-mail.
 * Sempre devolve `{ ok: true }`: nenhuma resposta pode revelar se o e-mail
 * existe, se está confirmado ou se o envio foi de fato realizado.
 */
export const registrarEventoEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const email = data.email && data.email.includes("@") ? data.email : null;
      let userId: string | null = null;
      if (email) {
        const { data: perfil } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        userId = perfil?.id ?? null;
      }

      await supabaseAdmin.from("email_events").insert({
        event_type: data.tipo,
        normalized_email: email,
        user_id: userId,
        provider: "supabase_auth",
        request_status: data.status,
        error_code: data.codigoErro ?? null,
        error_message: data.mensagemErro ?? null,
        request_reference: data.referencia ?? null,
      });
    } catch {
      /* registro é auxiliar: nunca interrompe nem altera o fluxo do usuário */
    }

    return { ok: true as const };
  });
