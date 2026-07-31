/**
 * Registro interno de eventos de uso (espelho do Google Analytics).
 *
 * Os mesmos eventos enviados ao GA4 são gravados na tabela
 * `app_analytics_events` para alimentar o painel interno de métricas,
 * que não depende de API externa. Falhas são silenciosas: métricas
 * nunca podem quebrar o fluxo do usuário.
 */
const CHAVE_SESSAO = "pg:sessao-metricas";

/** Identificador de sessão do navegador (por aba, sem dados pessoais). */
export function idSessao(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const atual = window.sessionStorage.getItem(CHAVE_SESSAO);
    if (atual) return atual;
    const novo =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(CHAVE_SESSAO, novo);
    return novo;
  } catch {
    return "sem-sessao";
  }
}

export function registrarEventoInterno(
  evento: string,
  dados?: { modo?: string; parametros?: Record<string, unknown> },
) {
  if (typeof window === "undefined") return;
  const caminho = window.location.pathname;
  const sessao = idSessao();
  void import("@/integrations/supabase/client")
    .then(({ supabase }) =>
      supabase.from("app_analytics_events").insert({
        evento,
        modo: dados?.modo ?? null,
        sessao_id: sessao,
        caminho,
        parametros: (dados?.parametros ?? {}) as never,
      }),
    )
    .then(
      () => undefined,
      () => undefined,
    );
}
