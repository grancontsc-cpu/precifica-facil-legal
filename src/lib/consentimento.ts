/**
 * Consentimento de cookies/analytics (LGPD).
 *
 * Nada de analytics é carregado antes de um "aceito" explícito.
 * A decisão fica no localStorage e pode ser revogada a qualquer momento.
 */
import { GA_MEASUREMENT_ID } from "./analytics";

export const CHAVE_CONSENTIMENTO = "precifica:consentimento-analytics";
export const VERSAO_CONSENTIMENTO = 1;

export type DecisaoConsentimento = "aceito" | "recusado";

export type RegistroConsentimento = {
  decisao: DecisaoConsentimento;
  versao: number;
  data: string;
};

export function lerConsentimento(): RegistroConsentimento | null {
  if (typeof window === "undefined") return null;
  try {
    const bruto = window.localStorage.getItem(CHAVE_CONSENTIMENTO);
    if (!bruto) return null;
    const dado = JSON.parse(bruto) as Partial<RegistroConsentimento>;
    if (dado?.decisao !== "aceito" && dado?.decisao !== "recusado") return null;
    if (dado.versao !== VERSAO_CONSENTIMENTO) return null;
    return {
      decisao: dado.decisao,
      versao: VERSAO_CONSENTIMENTO,
      data: typeof dado.data === "string" ? dado.data : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function gravarConsentimento(decisao: DecisaoConsentimento): RegistroConsentimento {
  const registro: RegistroConsentimento = {
    decisao,
    versao: VERSAO_CONSENTIMENTO,
    data: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CHAVE_CONSENTIMENTO, JSON.stringify(registro));
    } catch {
      /* armazenamento indisponível: a decisão vale apenas para esta sessão */
    }
  }
  return registro;
}

export function limparConsentimento() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CHAVE_CONSENTIMENTO);
  } catch {
    /* ignora */
  }
}

/** Remove os cookies gravados pelo GA (usado ao recusar/revogar). */
export function removerCookiesAnalytics() {
  if (typeof document === "undefined") return;
  const dominio = window.location.hostname;
  const partes = dominio.split(".");
  const dominios = [undefined, dominio, ...(partes.length > 1 ? [`.${partes.slice(-2).join(".")}`] : [])];
  for (const cookie of document.cookie.split(";")) {
    const nome = cookie.split("=")[0]?.trim();
    if (!nome) continue;
    if (!/^(_ga|_gid|_gat|__utm)/.test(nome)) continue;
    for (const d of dominios) {
      document.cookie = `${nome}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d ? `; domain=${d}` : ""}`;
    }
  }
}

let analyticsCarregado = false;

/** Carrega a tag do GA4 sob demanda — somente após consentimento. */
export function carregarAnalytics() {
  if (typeof window === "undefined" || analyticsCarregado) return;
  if (document.querySelector(`script[data-ga-tag="${GA_MEASUREMENT_ID}"]`)) {
    analyticsCarregado = true;
    return;
  }
  analyticsCarregado = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  script.dataset.gaTag = GA_MEASUREMENT_ID;
  document.head.appendChild(script);

  const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag(...args: unknown[]) {
    w.dataLayer!.push(args);
  };
  w.gtag("js", new Date());
  w.gtag("config", GA_MEASUREMENT_ID, { anonymize_ip: true });
}

export function analyticsPermitido(): boolean {
  return lerConsentimento()?.decisao === "aceito";
}
