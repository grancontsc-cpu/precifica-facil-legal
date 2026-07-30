/**
 * Ponte cliente → auditoria para tentativas de acesso negadas.
 * Deduplica eventos idênticos na mesma sessão para não inundar o log, e nunca
 * quebra a interface caso o registro falhe.
 */
import { registrarAcessoNegado } from "@/lib/seguranca.functions";

export type AcaoNegada = "carregar" | "salvar" | "duplicar" | "arquivar" | "criar";

export interface EventoNegado {
  acao: AcaoNegada;
  simulacaoId?: string | null;
  organizationId?: string | null;
  motivo?: string | null;
  origem?: string;
}

const jaRegistrados = new Set<string>();

export function registrarNegativa(evento: EventoNegado): void {
  const chave = [evento.acao, evento.simulacaoId ?? "-", evento.organizationId ?? "-"].join("|");
  if (jaRegistrados.has(chave)) return;
  jaRegistrados.add(chave);

  void registrarAcessoNegado({
    data: {
      acao: evento.acao,
      simulacaoId: evento.simulacaoId ?? null,
      organizationId: evento.organizationId ?? null,
      motivo: (evento.motivo ?? "Acesso negado.").slice(0, 500),
      origem: evento.origem,
    },
  }).catch(() => {
    // O bloqueio de acesso já aconteceu; falha de log não deve afetar a tela.
    jaRegistrados.delete(chave);
  });
}
