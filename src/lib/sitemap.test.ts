import { describe, expect, it } from "vitest";

import { caminhoDaRota, entradasDoSitemap, montarSitemapXml } from "./sitemap";

const ARQUIVOS = [
  "/src/routes/__root.tsx",
  "/src/routes/index.tsx",
  "/src/routes/login.tsx",
  "/src/routes/cadastro.tsx",
  "/src/routes/recuperar-senha.tsx",
  "/src/routes/entrando.tsx",
  "/src/routes/teste-expirado.tsx",
  "/src/routes/app.$.tsx",
  "/src/routes/app.index.tsx",
  "/src/routes/sitemap[.]xml.ts",
  "/src/routes/api/public/sitemap-ping.ts",
  "/src/routes/_authenticated/route.tsx",
  "/src/routes/_authenticated/simulador.tsx",
  "/src/routes/_authenticated/admin/emails.tsx",
];

describe("caminhoDaRota", () => {
  it("converte rota simples", () => {
    expect(caminhoDaRota("/src/routes/login.tsx")).toBe("/login");
  });

  it("trata index como raiz", () => {
    expect(caminhoDaRota("/src/routes/index.tsx")).toBe("/");
  });

  it("converte pontos em barras", () => {
    expect(caminhoDaRota("/src/routes/gestao.usuarios.tsx")).toBe("/gestao/usuarios");
  });

  it("ignora raiz, layouts privados, parâmetros, splat, colchetes e api", () => {
    for (const arquivo of [
      "/src/routes/__root.tsx",
      "/src/routes/_authenticated/simulador.tsx",
      "/src/routes/produtos.$id.tsx",
      "/src/routes/app.$.tsx",
      "/src/routes/sitemap[.]xml.ts",
      "/src/routes/api/public/sitemap-ping.ts",
    ]) {
      expect(caminhoDaRota(arquivo)).toBeNull();
    }
  });
});

describe("entradasDoSitemap", () => {
  const entradas = entradasDoSitemap(ARQUIVOS);
  const caminhos = entradas.map((e) => e.path);

  it("inclui apenas rotas públicas indexáveis", () => {
    expect(caminhos).toEqual(["/", "/cadastro", "/login", "/recuperar-senha"]);
  });

  it("exclui páginas de estado e rotas autenticadas", () => {
    expect(caminhos).not.toContain("/entrando");
    expect(caminhos).not.toContain("/teste-expirado");
    expect(caminhos).not.toContain("/simulador");
    expect(caminhos).not.toContain("/app");
  });

  it("mantém a raiz em primeiro lugar com prioridade máxima", () => {
    expect(entradas[0]).toMatchObject({ path: "/", priority: "1.0" });
  });

  it("aplica padrão para rotas novas não mapeadas", () => {
    const [nova] = entradasDoSitemap(["/src/routes/planos.tsx"]);
    expect(nova).toEqual({ path: "/planos", changefreq: "monthly", priority: "0.5" });
  });

  it("não repete caminhos duplicados", () => {
    const dup = entradasDoSitemap(["/src/routes/login.tsx", "/src/routes/login.tsx"]);
    expect(dup).toHaveLength(1);
  });
});

describe("montarSitemapXml", () => {
  const xml = montarSitemapXml("https://exemplo.com.br", entradasDoSitemap(ARQUIVOS));

  it("gera XML válido com todas as URLs absolutas", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain("<urlset");
    expect(xml.trimEnd().endsWith("</urlset>")).toBe(true);
    expect(xml).toContain("<loc>https://exemplo.com.br/</loc>");
    expect(xml).toContain("<loc>https://exemplo.com.br/login</loc>");
    expect((xml.match(/<url>/g) ?? []).length).toBe(4);
  });

  it("não inclui rotas privadas", () => {
    expect(xml).not.toContain("/simulador");
  });
});
