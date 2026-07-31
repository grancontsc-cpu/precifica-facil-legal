import { describe, expect, it } from "vitest";
import { SITE_URL, metaPagina, urlCanonica } from "@/lib/seo-head";

function get(meta: Array<Record<string, string>>, chave: string, valor: string) {
  return meta.find((m) => m["name"] === valor || m["property"] === valor)?.[chave];
}

describe("urlCanonica", () => {
  it("normaliza a raiz", () => {
    expect(urlCanonica("/")).toBe(`${SITE_URL}/`);
  });

  it("remove barras extras", () => {
    expect(urlCanonica("//login/")).toBe(`${SITE_URL}/login`);
  });
});

describe("metaPagina", () => {
  const indexavel = metaPagina({
    titulo: "Entrar — Precifica Grancont",
    descricao: "Acesse o simulador.",
    caminho: "/login",
    indexavel: true,
  });

  it("coloca o título dentro do array de meta", () => {
    expect(indexavel.meta[0]).toEqual({ title: "Entrar — Precifica Grancont" });
  });

  it("espelha título e descrição em Open Graph e Twitter", () => {
    expect(get(indexavel.meta, "content", "og:title")).toBe("Entrar — Precifica Grancont");
    expect(get(indexavel.meta, "content", "twitter:description")).toBe("Acesse o simulador.");
  });

  it("aponta og:url e canonical para a própria página", () => {
    expect(get(indexavel.meta, "content", "og:url")).toBe(`${SITE_URL}/login`);
    expect(indexavel.links).toEqual([{ rel: "canonical", href: `${SITE_URL}/login` }]);
  });

  it("página indexável não recebe robots noindex", () => {
    expect(get(indexavel.meta, "content", "robots")).toBeUndefined();
  });

  it("página de fluxo recebe noindex e não emite canonical", () => {
    const r = metaPagina({ titulo: "T", descricao: "D", caminho: "/onboarding" });
    expect(get(r.meta, "content", "robots")).toBe("noindex, nofollow");
    expect(r.links).toEqual([]);
  });

  it("usa cartão grande apenas onde faz sentido", () => {
    expect(get(indexavel.meta, "content", "twitter:card")).toBe("summary_large_image");
    const r = metaPagina({ titulo: "T", descricao: "D", caminho: "/entrando" });
    expect(get(r.meta, "content", "twitter:card")).toBe("summary");
  });
});
