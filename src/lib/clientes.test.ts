import { describe, it, expect } from "vitest";
import { estadoExemplo } from "@/lib/pricing-defaults";
import { premissasReforma } from "@/lib/revisao-premissas";
import { comPendencias, resumoPorCliente, type SimulacaoCliente } from "./clientes";

const base = (id: string, org: string, data: string, confirmar = false): SimulacaoCliente => {
  const state = estadoExemplo();
  if (confirmar) state.premissasConfirmadas = premissasReforma(state).map((p) => p.id);
  return { id, organizationId: org, titulo: id, produto: null, criadaEm: data, autor: null, state };
};

describe("tela de clientes", () => {
  it("conta simulações a revisar só quando há premissas sem confirmação", () => {
    const sims = comPendencias([
      base("a", "o1", "2026-01-01"),
      base("b", "o1", "2026-02-01", true),
      base("c", "o2", "2026-03-01", true),
    ]);
    expect(sims[1].pendencias).toBe(0);
    const r = resumoPorCliente(sims);
    expect(r.get("o1")).toEqual({ total: 2, aRevisar: sims[0].pendencias > 0 ? 1 : 0, ultimaEnvio: "2026-02-01" });
    expect(r.get("o2")!.aRevisar).toBe(0);
  });
});
