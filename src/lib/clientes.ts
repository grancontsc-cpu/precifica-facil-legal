import { pendentes } from "@/lib/revisao-premissas";
import type { SimulationState } from "@/types/pricing";

export interface SimulacaoCliente {
  id: string;
  organizationId: string;
  titulo: string;
  produto: string | null;
  criadaEm: string;
  autor: string | null;
  state: SimulationState | null;
}

export interface SimulacaoRevisao extends SimulacaoCliente {
  pendencias: number;
}

/** Marca quantas premissas da projeção ainda faltam confirmar em cada simulação. */
export function comPendencias(sims: SimulacaoCliente[]): SimulacaoRevisao[] {
  return sims.map((s) => ({ ...s, pendencias: s.state ? pendentes(s.state).length : 0 }));
}

export interface ResumoCliente {
  total: number;
  aRevisar: number;
  ultimaEnvio: string | null;
}

export function resumoPorCliente(sims: SimulacaoRevisao[]): Map<string, ResumoCliente> {
  const m = new Map<string, ResumoCliente>();
  for (const s of sims) {
    const r = m.get(s.organizationId) ?? { total: 0, aRevisar: 0, ultimaEnvio: null };
    r.total += 1;
    if (s.pendencias > 0) r.aRevisar += 1;
    if (!r.ultimaEnvio || s.criadaEm > r.ultimaEnvio) r.ultimaEnvio = s.criadaEm;
    m.set(s.organizationId, r);
  }
  return m;
}
