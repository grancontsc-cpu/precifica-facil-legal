import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PassoTeste, ResultadoTesteEmail } from "./email-diagnostico.functions";

/**
 * Teste de ponta a ponta do fluxo de e-mail, executado apenas no servidor.
 * Cada passo grava um registro em `email_events` com a mesma referência,
 * para que o painel /admin/emails mostre a execução completa.
 */

function clienteAnonimo() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

function senhaAleatoria() {
  return `Teste-${crypto.randomUUID().slice(0, 12)}-${Date.now().toString(36)}`;
}

/** Extrai a espera pedida pelo servidor em mensagens de limite de tentativas. */
export function segundosDeEspera(mensagem: string | undefined): number | null {
  if (!mensagem) return null;
  const m = mensagem.match(/(\d+)\s*second/i);
  return m ? Number(m[1]) : null;
}

export async function executarTeste(email: string, executorId: string): Promise<ResultadoTesteEmail> {
  const referencia = `teste-email:${crypto.randomUUID()}`;
  const iniciadoEm = new Date().toISOString();
  const passos: PassoTeste[] = [];
  const anon = clienteAnonimo();

  const registrar = async (
    tipo: string,
    titulo: string,
    status: PassoTeste["status"],
    detalhe: string,
    inicio: number,
    erro?: { code?: string; message?: string },
  ) => {
    const passo: PassoTeste = { chave: tipo, titulo, status, detalhe, duracaoMs: Date.now() - inicio };
    passos.push(passo);
    await supabaseAdmin.from("email_events").insert({
      event_type: tipo,
      normalized_email: email,
      provider: "supabase_auth",
      request_status: status,
      provider_status: detalhe.slice(0, 200),
      error_code: erro?.code ?? null,
      error_message: erro?.message?.slice(0, 300) ?? null,
      request_reference: referencia,
    });
  };

  // Passo 0 — garantir a conta controlada de teste.
  let criadoAgora = false;
  let usuarioId: string | null = null;
  {
    const t = Date.now();
    const { data: perfil } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (perfil?.id) {
      usuarioId = perfil.id;
      await registrar("teste_conta_preparada", "Conta controlada", "ok", "Conta já existente reutilizada no teste.", t);
    } else {
      const { data: novo, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: senhaAleatoria(),
        email_confirm: false,
      });
      if (error || !novo?.user) {
        await registrar("teste_conta_preparada", "Conta controlada", "erro", "Não foi possível criar a conta de teste.", t, {
          code: error?.code,
          message: error?.message,
        });
        return { referencia, email, iniciadoEm, passos, aprovado: false };
      }
      usuarioId = novo.user.id;
      criadoAgora = true;
      await registrar("teste_conta_preparada", "Conta controlada", "ok", "Conta de teste criada sem confirmação.", t);
    }
  }

  const tipoConfirmacao = criadoAgora ? "signup" : "magiclink";

  // Passo 1 — gerar o link de confirmação.
  let tokenConfirmacao: string | null = null;
  {
    const t = Date.now();
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink(
      criadoAgora
        ? { type: "signup", email, password: senhaAleatoria() }
        : { type: "magiclink", email },
    );
    tokenConfirmacao = link?.properties?.hashed_token ?? null;
    await registrar(
      "teste_confirmacao_enviada",
      "Link de confirmação gerado",
      error || !tokenConfirmacao ? "erro" : "ok",
      error || !tokenConfirmacao ? "Falha ao gerar o link." : `Link de ${tipoConfirmacao} gerado com sucesso.`,
      t,
      { code: error?.code, message: error?.message },
    );
  }

  // Passo 2 — usar o link (deve autenticar/confirmar).
  if (tokenConfirmacao) {
    const t = Date.now();
    const { error } = await anon.auth.verifyOtp({
      token_hash: tokenConfirmacao,
      type: criadoAgora ? "email" : "magiclink",
    });
    await anon.auth.signOut();
    await registrar(
      "teste_confirmacao_concluida",
      "Link de confirmação validado",
      error ? "erro" : "ok",
      error ? "O link válido foi recusado." : "O link válido foi aceito na primeira utilização.",
      t,
      { code: error?.code, message: error?.message },
    );

    // Passo 3 — reutilizar o mesmo link (deve ser recusado: uso único/expiração).
    const t2 = Date.now();
    const { error: erroReuso } = await anon.auth.verifyOtp({
      token_hash: tokenConfirmacao,
      type: criadoAgora ? "email" : "magiclink",
    });
    await registrar(
      "teste_link_expirado",
      "Link de confirmação expira após o uso",
      erroReuso ? "ok" : "erro",
      erroReuso
        ? "Reutilização recusada, como esperado."
        : "ATENÇÃO: o link foi aceito duas vezes. Verifique a configuração de expiração.",
      t2,
      { code: erroReuso?.code, message: erroReuso?.message },
    );
  }

  // Passo 4 — link de recuperação de senha.
  let tokenRecuperacao: string | null = null;
  {
    const t = Date.now();
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({ type: "recovery", email });
    tokenRecuperacao = link?.properties?.hashed_token ?? null;
    await registrar(
      "teste_recuperacao_enviada",
      "Link de recuperação gerado",
      error || !tokenRecuperacao ? "erro" : "ok",
      error || !tokenRecuperacao ? "Falha ao gerar o link de recuperação." : "Link de recuperação gerado com sucesso.",
      t,
      { code: error?.code, message: error?.message },
    );
  }

  if (tokenRecuperacao) {
    const t = Date.now();
    const { error } = await anon.auth.verifyOtp({ token_hash: tokenRecuperacao, type: "recovery" });
    await anon.auth.signOut();
    await registrar(
      "teste_recuperacao_validada",
      "Link de recuperação validado",
      error ? "erro" : "ok",
      error ? "O link de recuperação válido foi recusado." : "O link permitiu abrir a redefinição de senha.",
      t,
      { code: error?.code, message: error?.message },
    );

    const t2 = Date.now();
    const { error: erroReuso } = await anon.auth.verifyOtp({ token_hash: tokenRecuperacao, type: "recovery" });
    await registrar(
      "teste_recuperacao_expirada",
      "Link de recuperação expira após o uso",
      erroReuso ? "ok" : "erro",
      erroReuso
        ? "Reutilização recusada, como esperado."
        : "ATENÇÃO: o link de recuperação foi aceito duas vezes.",
      t2,
      { code: erroReuso?.code, message: erroReuso?.message },
    );
  }

  // Passo 5 — reenvio com cooldown (dois pedidos seguidos).
  {
    const t = Date.now();
    const { error: erro1 } = await anon.auth.resetPasswordForEmail(email);
    await registrar(
      "teste_reenvio_primeiro",
      "Primeiro pedido de reenvio",
      erro1 ? "erro" : "ok",
      erro1 ? "O primeiro pedido foi recusado." : "Primeiro pedido aceito.",
      t,
      { code: erro1?.code, message: erro1?.message },
    );

    const t2 = Date.now();
    const { error: erro2 } = await anon.auth.resetPasswordForEmail(email);
    const espera = segundosDeEspera(erro2?.message ?? undefined);
    const limitado = Boolean(erro2);
    await registrar(
      "teste_reenvio_cooldown",
      "Segundo pedido imediato (cooldown)",
      limitado ? "ok" : "ignorado",
      limitado
        ? `Pedido imediato bloqueado${espera ? ` — aguardar ${espera}s` : ""}, como esperado.`
        : "O servidor aceitou dois pedidos seguidos; o cooldown do app (5s/30s/60s) continua sendo a proteção principal.",
      t2,
      { code: erro2?.code, message: erro2?.message },
    );
  }

  // Limpeza — remove a conta criada só para o teste.
  if (criadoAgora && usuarioId) {
    const t = Date.now();
    const { error } = await supabaseAdmin.auth.admin.deleteUser(usuarioId);
    await registrar(
      "teste_conta_removida",
      "Conta de teste removida",
      error ? "erro" : "ok",
      error ? "Não foi possível remover a conta de teste." : "Conta de teste excluída após o ensaio.",
      t,
      { code: error?.code, message: error?.message },
    );
  }

  const aprovado = passos.every((p) => p.status !== "erro");

  await supabaseAdmin.from("audit_logs").insert({
    organization_id: null,
    actor_id: executorId,
    action: "teste_email_ponta_a_ponta",
    entity: "email_events",
    entity_id: null,
    before_data: null,
    after_data: { referencia, email, aprovado, passos } as never,
  });

  return { referencia, email, iniciadoEm, passos, aprovado };
}
