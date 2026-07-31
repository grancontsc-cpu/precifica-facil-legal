import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  eventoParametroFiscal,
  eventoSimulacaoIniciada,
  eventoSimular,
  reiniciarControleEventos,
} from "./analytics-eventos";

declare global {
  // eslint-disable-next-line no-var
  var gtag: ((...args: unknown[]) => void) | undefined;
}

describe("eventos de analytics do simulador", () => {
  let enviados: unknown[][];

  beforeEach(() => {
    reiniciarControleEventos();
    enviados = [];
    (globalThis as unknown as { gtag?: unknown }).gtag = (...args: unknown[]) => {
      enviados.push(args);
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { gtag?: unknown }).gtag;
    vi.useRealTimers();
  });

  it("não envia nada quando o GA não foi carregado (sem consentimento)", () => {
    delete (globalThis as unknown as { gtag?: unknown }).gtag;
    expect(() => eventoSimulacaoIniciada({ modo: "rapido", origem: "nova" })).not.toThrow();
    expect(enviados).toHaveLength(0);
  });

  it("registra o início da simulação com modo e origem", () => {
    eventoSimulacaoIniciada({ modo: "completo", origem: "carregada" });
    expect(enviados[0]).toEqual([
      "event",
      "simulacao_iniciada",
      { modo_simulador: "completo", origem_simulacao: "carregada" },
    ]);
  });

  it("registra mudança de parâmetro fiscal", () => {
    eventoParametroFiscal({ modo: "rapido", campo: "ufOrigem", valor: "RJ" });
    expect(enviados[0]).toEqual([
      "event",
      "parametro_fiscal_alterado",
      { modo_simulador: "rapido", campo_fiscal: "ufOrigem", valor_fiscal: "RJ" },
    ]);
  });

  it("agrupa alterações repetidas do mesmo campo dentro da janela", () => {
    eventoParametroFiscal({ modo: "rapido", campo: "ufOrigem", valor: "RJ" });
    eventoParametroFiscal({ modo: "rapido", campo: "ufOrigem", valor: "SP" });
    expect(enviados).toHaveLength(1);
  });

  it("campos diferentes são registrados separadamente", () => {
    eventoParametroFiscal({ modo: "rapido", campo: "ufOrigem", valor: "RJ" });
    eventoParametroFiscal({ modo: "rapido", campo: "ufDestino", valor: "BA" });
    expect(enviados).toHaveLength(2);
  });

  it("registra o clique em simular com trajeto e regime", () => {
    eventoSimular({
      modo: "rapido",
      regime: "simples",
      ufOrigem: "RJ",
      ufDestino: "BA",
      possuiResultado: true,
    });
    expect(enviados[0]).toEqual([
      "event",
      "simular",
      {
        modo_simulador: "rapido",
        regime: "simples",
        uf_origem: "RJ",
        uf_destino: "BA",
        resultado_valido: true,
      },
    ]);
  });
});
