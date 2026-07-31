/** Regras de licença (motor puro, sem acesso a banco ou interface). */

export type StatusLicenca = "trial" | "active" | "suspended" | "expired" | "canceled";

/** Status como gravado no banco (inclui variantes que a UI normaliza). */
export type StatusLicencaBanco = StatusLicenca | "courtesy" | "trial_expired";

export interface Licenca {
  status: StatusLicencaBanco;
  plan: string;
  trial_started_at: string;
  trial_ends_at: string;
  activated_at: string | null;
  expires_at: string | null;
  notes: string | null;
}

export const ROTULO_LICENCA: Record<StatusLicenca, string> = {
  trial: "Teste gratuito",
  active: "Licença ativa",
  suspended: "Suspensa",
  expired: "Expirada",
  canceled: "Cancelada",
};

export interface SituacaoLicenca {
  liberado: boolean;
  status: StatusLicenca;
  emTeste: boolean;
  diasRestantes: number | null;
  motivo: string;
}

const DIA = 24 * 60 * 60 * 1000;

export function diasRestantes(ate: string | null, agora = new Date()): number | null {
  if (!ate) return null;
  const fim = new Date(ate).getTime();
  if (Number.isNaN(fim)) return null;
  return Math.ceil((fim - agora.getTime()) / DIA);
}

/** Avalia se a licença libera o uso do sistema neste momento. */
export function avaliarLicenca(licenca: Licenca | null, agora = new Date()): SituacaoLicenca {
  if (!licenca) {
    return {
      liberado: false,
      status: "suspended",
      emTeste: false,
      diasRestantes: null,
      motivo: "Não encontramos uma licença ativa para a sua conta.",
    };
  }

  if (licenca.status === "canceled") {
    return {
      liberado: false,
      status: "canceled",
      emTeste: false,
      diasRestantes: null,
      motivo: "A licença desta conta foi cancelada.",
    };
  }

  if (licenca.status === "active" || licenca.status === "courtesy") {
    const fim = licenca.expires_at ? new Date(licenca.expires_at).getTime() : null;
    const vencida = fim !== null && fim <= agora.getTime();
    return {
      liberado: !vencida,
      status: vencida ? "expired" : "active",
      emTeste: false,
      diasRestantes: diasRestantes(licenca.expires_at, agora),
      motivo: vencida ? "A licença da sua conta venceu." : "Licença ativa.",
    };
  }

  if (licenca.status === "trial") {
    const dias = diasRestantes(licenca.trial_ends_at, agora) ?? 0;
    const ativo = new Date(licenca.trial_ends_at).getTime() > agora.getTime();
    return {
      liberado: ativo,
      status: ativo ? "trial" : "expired",
      emTeste: true,
      diasRestantes: dias,
      motivo: ativo
        ? `Período de teste gratuito: ${dias} dia(s) restante(s).`
        : "Seu período de teste gratuito de 30 dias terminou.",
    };
  }

  return {
    liberado: false,
    status: licenca.status === "suspended" ? "suspended" : "expired",
    emTeste: false,
    diasRestantes: null,
    motivo:
      licenca.status === "suspended"
        ? "Sua licença está suspensa pelo Administrador Geral."
        : "Sua licença está expirada.",
  };
}
