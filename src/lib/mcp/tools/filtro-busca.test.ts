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

  it("preserva acentos e normaliza NFD para NFC/NFKC", () => {
    const decomposto = "cafe\u0301 c\u0327amara"; // café câmara (com combinantes)
    const limpo = sanitizarBusca(decomposto);
    expect(limpo).toBe("café çamara".normalize("NFKC"));
    expect(limpo).toBe(limpo.normalize("NFKC"));
  });

  it("mantém acentos maiúsculos e ç em largura total", () => {
    expect(sanitizarBusca("ＡÇÚＣＡＲ")).toBe("AÇÚCAR");
  });

  it("converte espaços especiais (NBSP, fino, ideográfico) em espaço simples", () => {
    expect(sanitizarBusca("caf\u00e9\u00a0com\u2009leite\u3000quente")).toBe(
      "café com leite quente",
    );
  });

  it("remove caracteres invisíveis (zero-width, BOM, hífen suave)", () => {
    expect(sanitizarBusca("\ufeffpro\u200bdu\u200dto\u00adx")).toBe("produtox");
  });

  it("remove marcas de direção e separadores de linha Unicode", () => {
    expect(sanitizarBusca("a\u200eb\u200fc\u2028d\u2029e")).toBe("abcde");
  });

  it("retorna vazio quando o texto tem apenas caracteres invisíveis", () => {
    expect(sanitizarBusca("\u200b\u200b\u00ad\ufeff")).toBe("");
    expect(sanitizarBusca("\u00a0\u2009\u3000")).toBe("");
  });

  it("normaliza ligaduras e frações antes de montar o filtro", () => {
    expect(sanitizarBusca("caﬁné ½ kg")).toBe("caifiné 1⁄2 kg");
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
