import { describe, expect, it } from "vitest";
import { MAX_BUSCA, filtroIlike, sanitizarBusca } from "./filtro-busca";

describe("sanitizarBusca", () => {
  it("faz trim e colapsa espaços duplicados", () => {
    expect(sanitizarBusca("  café   com   leite  ")).toBe("café com leite");
  });

  it("remove caracteres de controle e quebras de linha", () => {
    expect(sanitizarBusca("linha1\nlinha2\tfim")).toBe("linha1 linha2 fim");
  });

  it("remove caracteres com significado no PostgREST e curingas do LIKE", () => {
    expect(sanitizarBusca("a,b.c(d)e'f\"g\\h%i_j*k")).toBe("a b c d e f g h i j k");
  });

  it("limita o tamanho e não deixa espaço final", () => {
    const texto = `${"a".repeat(MAX_BUSCA - 1)}   fim`;
    const limpo = sanitizarBusca(texto);
    expect(limpo.length).toBeLessThanOrEqual(MAX_BUSCA);
    expect(limpo).toBe("a".repeat(MAX_BUSCA - 1));
  });

  it("normaliza Unicode (NFKC)", () => {
    expect(sanitizarBusca("ｐｒｏｄｕｔｏ")).toBe("produto");
  });

  it("retorna vazio para entradas inválidas", () => {
    expect(sanitizarBusca(undefined)).toBe("");
    expect(sanitizarBusca("   ,,,   ")).toBe("");
  });
});

describe("filtroIlike", () => {
  it("monta o filtro com o texto normalizado", () => {
    expect(filtroIlike(["nome", "sku"], "  abc,  def ")).toBe(
      "nome.ilike.%abc def%,sku.ilike.%abc def%",
    );
  });

  it("retorna null quando não sobra texto útil", () => {
    expect(filtroIlike(["nome"], "  ()  ")).toBeNull();
  });
});
