import { describe, expect, it } from "vitest";

import { estadoExemplo } from "@/lib/pricing-defaults";
import { simular } from "@/lib/pricing-engine";
import { compararFornecedores } from "@/lib/supplier-comparison";
import { exemploComparacao } from "@/lib/comparison-defaults";
import {
  AVISO_GERENCIAL,
  csvRelatorio,
  montarRelatorio,
  nomeArquivo,
  whatsappRelatorio,
  type RelatorioMeta,
} from "@/lib/report";

const meta: RelatorioMeta = {
  empresa: "Cliente Exemplo Ltda",
  produto: "Café torrado 500g",
  tituloSimulacao: "Simulação de setembro",
  perfilTributario: "Comércio padrão (v2)",
  dataSimulacao: new Date(2026, 6, 15, 10, 30),
  emitidoPor: "usuario@grancont.com.br",
  camposAlterados: ["Margem desejada"],
  camposBloqueados: ["Tributos da compra"],
  observacoes: "Preço válido para o lote atual.\nSegunda linha.",
};

function relatorio(comparacao = false) {
  const state = estadoExemplo();
  const resultado = simular(state);
  const comp = comparacao
    ? compararFornecedores(exemploComparacao(), state.produto.nome)
    : null;
  return { state, resultado, rel: montarRelatorio(state, resultado, meta, comp) };
}

describe("relatório de exportação", () => {
  it("preserva a memória de cálculo em blocos, não só o preço final", () => {
    const { rel } = relatorio();
    const titulos = rel.blocos.map((b) => b.titulo);
    expect(titulos).toEqual([
      "Dados da compra",
      "Tributos e créditos da compra",
      "Custo líquido de aquisição",
      "Formação do preço de venda",
      "Preço sugerido e margem",
    ]);
    const memoria = rel.blocos.flatMap((b) => b.linhas);
    expect(memoria.length).toBeGreaterThan(20);
  });

  it("usa exatamente os números do motor, sem recalcular", () => {
    const { resultado, rel } = relatorio();
    expect(rel.resumo.custoLiquidoUnitario).toBe(resultado.compra.custoLiquidoUnitario);
    expect(rel.resumo.precoSugerido).toBe(resultado.recomendado!.precoFinal);
    expect(rel.resumo.margem).toBe(resultado.recomendado!.margemEfetiva);
  });

  it("detalha tributos com alíquota, base, tratamento e crédito", () => {
    const { rel } = relatorio();
    const bloco = rel.blocos.find((b) => b.titulo === "Tributos e créditos da compra")!;
    expect(bloco.linhas[0].detalhe).toMatch(/Alíquota/);
    expect(bloco.linhas[0].valor).toMatch(/crédito/);
  });

  it("inclui identificação: empresa, produto, data e perfil", () => {
    const { rel } = relatorio();
    expect(rel.meta.empresa).toBe("Cliente Exemplo Ltda");
    expect(rel.meta.perfilTributario).toBe("Comércio padrão (v2)");
    expect(rel.meta.dataSimulacao.getFullYear()).toBe(2026);
  });

  it("lista premissas incluindo cenário, base da margem e bloqueios", () => {
    const { rel } = relatorio();
    const texto = rel.premissas.join(" | ");
    expect(texto).toMatch(/Cenário tributário/);
    expect(texto).toMatch(/Base da margem/);
    expect(texto).toMatch(/Campos bloqueados pela Grancont: Tributos da compra/);
    expect(texto).toMatch(/Campos alterados manualmente/);
  });

  it("sempre traz o aviso de simulação gerencial", () => {
    const { rel } = relatorio();
    expect(rel.aviso).toBe(AVISO_GERENCIAL);
    expect(rel.aviso).toMatch(/simulação gerencial/i);
  });

  it("anexa a comparação de fornecedores quando existir", () => {
    const semComparacao = relatorio(false);
    expect(semComparacao.rel.comparacao).toBeNull();

    const comComparacao = relatorio(true);
    expect(comComparacao.rel.comparacao).not.toBeNull();
    expect(comComparacao.rel.comparacao!.linhas.length).toBeGreaterThanOrEqual(2);
    expect(comComparacao.rel.comparacao!.linhas.some((l) => l.destaque)).toBe(true);
  });
});

describe("CSV", () => {
  it("usa BOM, ponto e vírgula e cabeçalho de quatro colunas", () => {
    const { rel } = relatorio(true);
    const csv = csvRelatorio(rel);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.split("\r\n")[0]).toBe('\uFEFF"Bloco";"Item";"Valor";"Detalhe"');
  });

  it("contém identificação, todos os blocos, premissas e aviso", () => {
    const { rel } = relatorio(true);
    const csv = csvRelatorio(rel);
    for (const alvo of [
      "Empresa",
      "Perfil tributário",
      "Custo líquido de aquisição",
      "Formação do preço de venda",
      "Comparação entre fornecedores",
      "Premissa 1",
      "Observações",
      "Simulação gerencial",
    ]) {
      expect(csv).toContain(alvo);
    }
  });

  it("escapa aspas dos textos", () => {
    const state = estadoExemplo();
    state.produto.nome = 'Café "premium" 500g';
    const rel = montarRelatorio(state, simular(state), meta);
    expect(csvRelatorio(rel)).toContain('Café ""premium"" 500g');
  });
});

describe("resumo para WhatsApp", () => {
  it("mostra produto, custo líquido, preço sugerido, margem e observação", () => {
    const { rel } = relatorio();
    const texto = whatsappRelatorio(rel);
    expect(texto).toMatch(/Produto: /);
    expect(texto).toMatch(/Custo líquido unitário: R\$/);
    expect(texto).toMatch(/Preço sugerido: R\$/);
    expect(texto).toMatch(/Margem: .*%/);
    expect(texto).toMatch(/Observação: /);
  });

  it("é objetivo: no máximo dez linhas", () => {
    const { rel } = relatorio(true);
    expect(whatsappRelatorio(rel).split("\n").length).toBeLessThanOrEqual(10);
  });

  it("usa a primeira observação informada como principal", () => {
    const state = estadoExemplo();
    const rel = montarRelatorio(state, simular(state), meta);
    expect(rel.resumo.principalObservacao).toBe("Preço válido para o lote atual.");
  });

  it("cai para mensagem padrão quando não há observação", () => {
    const state = estadoExemplo();
    const rel = montarRelatorio(state, simular(state), { ...meta, observacoes: "" });
    expect(rel.resumo.principalObservacao.length).toBeGreaterThan(0);
  });
});

describe("nome do arquivo", () => {
  it("gera slug sem acento com data", () => {
    const { rel } = relatorio();
    expect(nomeArquivo(rel, "csv")).toMatch(/^[a-z0-9-]+-20260715\.csv$/);
  });
});
