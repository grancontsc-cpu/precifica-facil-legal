import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
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

/** Códigos de erro aceitos de chamadas não autenticadas (evita texto arbitrário). */
const CODIGOS_ERRO_PERMITIDOS = new Set([
  "email_nao_confirmado",
  "credenciais_invalidas",
  "limite_excedido",
  "token_invalido",
  "token_expirado",
  "falha_envio",
  "erro_desconhecido",
]);

/** Confirma o token do usuário logado, se houver. Nunca lança. */
async function usuarioVerificado(): Promise<string | null> {
  try {
    const authHeader = getRequest()?.headers?.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice("Bearer ".length);
    if (token.split(".").length !== 3) return null;

    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return null;

    const cliente = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await cliente.auth.getClaims(token);
    if (error || !data?.claims?.sub) return null;
    return String(data.claims.sub);
  } catch {
    return null;
  }
}

/**
 * Registra um evento do fluxo de e-mail.
 *
 * Segurança: o endpoint é público por necessidade (cadastro e recuperação
 * acontecem sem sessão), então nada vindo do cliente é tratado como confiável:
 * - o vínculo com uma conta real (`user_id`) só é gravado quando o chamador
 *   apresenta um token de sessão válido, e sempre com o id do token;
 * - chamadas anônimas ficam marcadas como não verificadas e não podem
 *   inserir texto livre de erro (apenas códigos de uma lista fechada);
 * - o e-mail informado por anônimos é gravado apenas como referência do
 *   fluxo, sem consulta a `profiles`.
 *
 * Sempre devolve `{ ok: true }`: nenhuma resposta pode revelar se o e-mail
 * existe, se está confirmado ou se o envio foi de fato realizado.
 */
export const registrarEventoEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const userId = await usuarioVerificado();
      const verificado = userId !== null;
      const email = data.email && data.email.includes("@") ? data.email : null;

      let emailVerificado: string | null = null;
      if (verificado) {
        const { data: perfil } = await supabaseAdmin
          .from("profiles")
          .select("email")
          .eq("id", userId)
          .maybeSingle();
        emailVerificado = perfil?.email ?? null;
      }

      const codigo = data.codigoErro ?? null;

      await supabaseAdmin.from("email_events").insert({
        event_type: data.tipo,
        normalized_email: verificado ? emailVerificado : email,
        // Vínculo com a conta apenas quando a identidade foi comprovada.
        user_id: userId,
        provider: verificado ? "supabase_auth" : "supabase_auth_nao_verificado",
        request_status: data.status,
        error_code: verificado
          ? codigo
          : codigo && CODIGOS_ERRO_PERMITIDOS.has(codigo)
            ? codigo
            : null,
        // Texto livre só é aceito de chamadas autenticadas.
        error_message: verificado ? (data.mensagemErro ?? null) : null,
        request_reference: verificado ? (data.referencia ?? null) : null,
      });
    } catch {
      /* registro é auxiliar: nunca interrompe nem altera o fluxo do usuário */
    }

    return { ok: true as const };
  });
