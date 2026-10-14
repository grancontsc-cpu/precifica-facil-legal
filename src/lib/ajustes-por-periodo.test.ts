import { describe, it, expect } from "vitest";
import { estadoInicial } from "@/lib/pricing-defaults";
import { perfilDoPeriodo, trocarPeriodo, type AjustesPorPeriodo } from "./ajustes-por-periodo";

function comIcms(rate: number) {
  const s = estadoInicial();
  return {
    ...s,
    tributosCompra: s.tributosCompra.map((t) => (t.id === "icms" ? { ...t, rate } : t)),
  };
}

describe("ajustes por período", () => {
  it("volta ao período anterior com a alíquota ajustada", () => {
    let mem: AjustesPorPeriodo = {};
    const inicio = comIcms(7);
    const ida = trocarPeriodo(inicio, "vigencia2027", mem);
    mem = ida.memoria;
    expect(ida.restaurado).toBe(false);
    const volta = trocarPeriodo(ida.state, inicio.operacao?.marcoTemporal ?? "atual", mem);
    expect(volta.restaurado).toBe(true);
    expect(volta.state.tributosCompra.find((t) => t.id === "icms")?.rate).toBe(7);
  });

  it("guarda o ajuste feito em 2027 ao ir para 2033 e voltar", () => {
    const a = trocarPeriodo(estadoInicial(), "vigencia2027", {});
    const ajustado = {
      ...a.state,
      tributosVenda: a.state.tributosVenda.map((t) =>
        t.id === "cbsVenda" ? { ...t, rate: 9.3 } : t,
      ),
    };
    const b = trocarPeriodo(ajustado, "definitivo2033", a.memoria);
    const c = trocarPeriodo(b.state, "vigencia2027", b.memoria);
    expect(c.state.tributosVenda.find((t) => t.id === "cbsVenda")?.rate).toBe(9.3);
    expect(c.state.operacao?.marcoTemporal).toBe("vigencia2027");
  });

  it("prefere o perfil da empresa e o mais recente", () => {
    const perfis = [
      { id: "g", organization_id: null, marco_temporal: "vigencia2027", updated_at: "2026-10-01" },
      { id: "a", organization_id: "o1", marco_temporal: "vigencia2027", updated_at: "2026-01-01" },
      { id: "b", organization_id: "o1", marco_temporal: "vigencia2027", updated_at: "2026-05-01" },
      { id: "c", organization_id: "o1", marco_temporal: "atual", updated_at: "2026-09-01" },
    ];
    expect(perfilDoPeriodo(perfis, "o1", "vigencia2027")?.id).toBe("b");
    expect(perfilDoPeriodo(perfis, "o2", "vigencia2027")?.id).toBe("g");
    expect(perfilDoPeriodo(perfis, "o1", "definitivo2033")).toBeNull();
  });
});
