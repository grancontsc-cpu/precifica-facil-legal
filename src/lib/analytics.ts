/**
 * Google Analytics (GA4) — tag única do site.
 * O carregamento da tag é feito no head raiz (src/routes/__root.tsx).
 * Aqui ficam apenas os helpers de envio de eventos.
 */
export const GA_MEASUREMENT_ID = "G-WGQH5BE9G1";

type Gtag = (...args: unknown[]) => void;

function gtag(): Gtag | null {
  const fn = (globalThis as unknown as { gtag?: Gtag }).gtag;
  return typeof fn === "function" ? fn : null;
}

/** Envia um page_view manual (necessário em navegação SPA). */
export function registrarPageView(caminho: string) {
  gtag()?.("event", "page_view", {
    page_path: caminho,
    page_location: typeof window !== "undefined" ? window.location.href : undefined,
    page_title: typeof document !== "undefined" ? document.title : undefined,
  });
}

/** Envia um evento personalizado. */
export function registrarEvento(nome: string, parametros?: Record<string, unknown>) {
  gtag()?.("event", nome, parametros ?? {});
}
