import { describe, expect, it } from "vitest";
import { aplicarRegime, estadoInicial, operacaoPadrao } from "@/lib/pricing-defaults";
import { aplicarRespostas, respostasPadrao, tributado } from "@/lib/impostos-rapido";
import type { Regime } from "@/types/pricing";

function estado(regime: Regime) {
  const base = aplicarRegime(estadoInicial(), regime);
  return {
    ...base,
    operacao: operacaoPadrao({
      regime,
      ufOrigem: "RJ",
      ufDestino: "BA",
      aliquotaInternaDestino: 20.5,
      aliquotaInterestadual: 7,
    }),
  };
}

const taxa = (lista: { id: string; rate: number; enabled: boolean }[], id: string) =>
  lista.find((t) => t.id === id)!;

describe("impostos do modo rápido", () => {
  it('trata "não sei" como tributado', () => {
    expect(tributado("naoSei")).toBe(true);
    expect(tributado("sim")).toBe(true);
    expect(tributado("nao")).toBe(false);
  });

  it("puxa as alíquotas do trajeto quando há ICMS", () => {
    const s = aplicarRespostas(estado("real"), respostasPadrao());
    expect(taxa(s.tributosCompra, "icms")).toMatchObject({ enabled: true, rate: 7 });
    expect(taxa(s.tributosVenda, "icmsVenda")).toMatchObject({ enabled: true, rate: 20.5 });
  });

  it("zera o ICMS quando a mercadoria não é tributada", () => {
    const s = aplicarRespostas(estado("real"), { ...respostasPadrao(), icms: "nao" });
    expect(taxa(s.tributosCompra, "icms")).toMatchObject({ enabled: false, rate: 0 });
    expect(s.operacao?.difalAtivo).toBe(false);
  });

  it("respeita as alíquotas de PIS/Cofins informadas e o regime", () => {
    const presumido = aplicarRespostas(estado("presumido"), respostasPadrao());
    expect(taxa(presumido.tributosVenda, "pisVenda").rate).toBe(0.65);
    const custom = aplicarRespostas(estado("real"), {
      ...respostasPadrao(),
      aliquotaPis: 1,
      aliquotaCofins: 5,
    });
    expect(taxa(custom.tributosCompra, "cofins").rate).toBe(5);
  });

  it("desliga ICMS e PIS/Cofins no Simples", () => {
    const s = aplicarRespostas(estado("simples"), { ...respostasPadrao(), icms: "sim" });
    expect(taxa(s.tributosCompra, "icms").enabled).toBe(false);
    expect(taxa(s.tributosCompra, "pis").enabled).toBe(false);
  });
});
