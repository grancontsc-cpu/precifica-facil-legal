import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Diagnóstico de e-mail: leitura do histórico de `email_events` e execução de
 * um teste de ponta a ponta com endereço controlado (link de confirmação,
 * link de recuperação, expiração/uso único e cooldown de reenvio).
 *
 * Tudo é restrito ao Administrador Geral e todo passo do teste vira um
 * registro em `email_events`, com a mesma referência (`request_reference`).
 */

const filtroSchema = z.object({
  email: z.string().trim().toLowerCase().max(200).optional(),
  tipo: z.string().trim().max(60).optional(),
  limite: z.number().int().min(10).max(500).default(100),
});

export interface EventoEmail {
  id: string;
  tipo: string;
  email: string | null;
  status: string;
  provedor: string;
  codigoErro: string | null;
  mensagemErro: string | null;
  referencia: string | null;
  criadoEm: string;
}

async function exigirSuperAdmin(supabase: { rpc: (fn: "is_super_admin") => PromiseLike<{ data: unknown }> }) {
  const { data } = await supabase.rpc("is_super_admin");
  if (data !== true) throw new Error("Acesso restrito ao Administrador Geral.");
}

export const listarEventosEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => filtroSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<EventoEmail[]> => {
    await exigirSuperAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let consulta = supabaseAdmin
      .from("email_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limite);

    if (data.email) consulta = consulta.eq("normalized_email", data.email);
    if (data.tipo) consulta = consulta.eq("event_type", data.tipo);

    const { data: linhas, error } = await consulta;
    if (error) throw new Error("Não foi possível carregar o histórico de e-mails.");

    return (linhas ?? []).map((l) => ({
      id: l.id,
      tipo: l.event_type,
      email: l.normalized_email,
      status: l.request_status,
      provedor: l.provider,
      codigoErro: l.error_code,
      mensagemErro: l.error_message,
      referencia: l.request_reference,
      criadoEm: l.created_at,
    }));
  });

export interface PassoTeste {
  chave: string;
  titulo: string;
  status: "ok" | "erro" | "ignorado";
  detalhe: string;
  duracaoMs: number;
}

export interface ResultadoTesteEmail {
  referencia: string;
  email: string;
  iniciadoEm: string;
  passos: PassoTeste[];
  aprovado: boolean;
}

const testeSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido para o teste.").max(200),
});

export const executarTesteEmailPontaAPonta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => testeSchema.parse(input))
  .handler(async ({ data, context }): Promise<ResultadoTesteEmail> => {
    await exigirSuperAdmin(context.supabase);
    const { executarTeste } = await import("./email-diagnostico.server");
    return executarTeste(data.email, context.userId);
  });
