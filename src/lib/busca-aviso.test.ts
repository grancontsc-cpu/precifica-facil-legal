import { describe, expect, it } from "vitest";
import { avaliarBusca } from "./busca-aviso";

describe("avaliarBusca", () => {
  it("não avisa nada para texto simples", () => {
    const r = avaliarBusca("cimento cp2");
    expect(r.termo).toBe("cimento cp2");
    expect(r.aviso).toBeNull();
    expect(r.excedeu).toBe(false);
  });

  it("não avisa para texto vazio", () => {
    expect(avaliarBusca("   ").aviso).toBeNull();
  });

  it("avisa quando o texto é normalizado", () => {
    const r = avaliarBusca("cimento,  cp2%");
    expect(r.normalizado).toBe(true);
    expect(r.termo).toBe("cimento cp2");
    expect(r.aviso).toContain("Ajustamos o texto da busca");
    expect(r.aviso).toContain("cimento cp2");
  });

  it("avisa e corta quando excede 100 caracteres", () => {
    const r = avaliarBusca("a".repeat(150));
    expect(r.excedeu).toBe(true);
    expect(r.termo).toHaveLength(100);
    expect(r.aviso).toContain("100 caracteres");
  });
});
