import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * jsdom não calcula layout real, então a garantia de suporte a fonte ampliada
 * (até 200%) é feita por invariantes de estilo nos componentes do cabeçalho:
 * nada de altura fixa em px, nada de texto travado em linha única e larguras
 * sempre limitadas pela viewport.
 */
function ler(caminho: string) {
  return readFileSync(resolve(process.cwd(), caminho), "utf8");
}

describe("suporte a aumento de fonte (até 200%)", () => {
  const logo = ler("src/components/app/LogoInicio.tsx");
  const shell = ler("src/components/app/AppShell.tsx");
  const tooltip = ler("src/components/ui/tooltip.tsx");

  it("logo do cabeçalho usa altura relativa à fonte com teto", () => {
    expect(logo).toContain("h-[2em]");
    expect(logo).toContain("max-h-10");
    expect(logo).not.toMatch(/LogoGrancont className="h-7/);
  });

  it("link da logo não trava o texto em linha única e limita a largura", () => {
    expect(logo).not.toContain("whitespace-nowrap");
    expect(logo).toContain("max-w-[min(60vw,18rem)]");
  });

  it("atalho de teclado pode crescer em altura e respeita a viewport", () => {
    expect(shell).toContain("focus-visible:h-auto");
    expect(shell).toContain("focus-visible:max-w-[calc(100vw-1.5rem)]");
    expect(shell).toContain("min-h-11");
  });

  it("barra do cabeçalho cresce em vez de cortar conteúdo", () => {
    expect(shell).toContain("min-h-16");
    expect(shell).toContain("flex-wrap");
  });

  it("tooltip limita largura/altura e quebra palavras longas", () => {
    expect(tooltip).toContain("max-w-[min(24em,calc(100vw-1.5rem))]");
    expect(tooltip).toContain("max-h-[min(20rem,calc(100vh-4rem))]");
    expect(tooltip).toContain("break-words");
  });
});
