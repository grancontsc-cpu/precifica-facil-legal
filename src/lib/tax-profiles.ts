/**
 * Conversão entre os perfis tributários persistidos no banco e o estado
 * do motor de cálculo. Nenhuma fórmula vive aqui — apenas mapeamento.
 */
import { estadoInicial, tributosCompraPadrao, tributosVendaPadrao } from "@/lib/pricing-defaults";
import type {
  PurchaseTax,
  SaleTax,
  ScenarioId,
  SimulationState,
  TaxTreatment,
  CreditMode,
  BaseMode,
} from "@/types/pricing";

export type TaxProfileRow = {
  id: string;
  organization_id: string | null;
  name: string;
  scenario: ScenarioId;
  valid_from: string;
  valid_to: string | null;
  notes: string | null;
  active: boolean;
  version: number;
  locked_fields: unknown;
  created_at: string;
  updated_at: string;
};

export type TaxProfileLineRow = {
  id?: string;
  tax_profile_id?: string;
  side: "compra" | "venda";
  tax_id: string;
  label: string;
  enabled: boolean;
  rate: number | string;
  base_mode: string;
  base_manual: number | string;
  base_reduction: number | string;
  use_manual_tax: boolean;
  manual_tax_value: number | string;
  treatment: string;
  credit_mode: string;
  credit_percent: number | string;
  credit_manual: number | string;
  note: string | null;
};

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function lockedFieldsOf(profile: Pick<TaxProfileRow, "locked_fields"> | null | undefined): string[] {
  const raw = profile?.locked_fields;
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === "string");
  return [];
}

/** Aplica as linhas do perfil tributário sobre o estado do simulador. */
export function aplicarPerfil(
  base: SimulationState,
  profile: TaxProfileRow,
  linhas: TaxProfileLineRow[],
): SimulationState {
  const compraBase = tributosCompraPadrao();
  const vendaBase = tributosVendaPadrao();

  const compra: PurchaseTax[] = compraBase.map((t) => {
    const l = linhas.find((x) => x.side === "compra" && x.tax_id === t.id);
    if (!l) return t;
    return {
      ...t,
      enabled: !!l.enabled,
      rate: num(l.rate),
      baseMode: (l.base_mode as BaseMode) ?? "padrao",
      baseManual: num(l.base_manual),
      baseReduction: num(l.base_reduction),
      useManualTax: !!l.use_manual_tax,
      manualTaxValue: num(l.manual_tax_value),
      treatment: (l.treatment as TaxTreatment) ?? "incluido",
      creditMode: (l.credit_mode as CreditMode) ?? "nao",
      creditPercent: num(l.credit_percent),
      creditManual: num(l.credit_manual),
      note: l.note ?? "",
    };
  });

  const venda: SaleTax[] = vendaBase.map((t) => {
    const l = linhas.find((x) => x.side === "venda" && x.tax_id === t.id);
    if (!l) return t;
    return {
      ...t,
      enabled: !!l.enabled,
      rate: num(l.rate),
      baseMode: (l.base_mode as BaseMode) ?? "padrao",
      baseManual: num(l.base_manual),
      treatment: (l.treatment as TaxTreatment) ?? "incluido",
    };
  });

  return { ...base, cenario: profile.scenario, tributosCompra: compra, tributosVenda: venda };
}

/** Cria as linhas persistíveis a partir de um estado do simulador. */
export function linhasDoEstado(state: SimulationState) {
  const compra = state.tributosCompra.map((t) => ({
    side: "compra" as const,
    tax_id: t.id,
    label: t.label,
    enabled: t.enabled,
    rate: num(t.rate),
    base_mode: t.baseMode,
    base_manual: num(t.baseManual),
    base_reduction: num(t.baseReduction),
    use_manual_tax: t.useManualTax,
    manual_tax_value: num(t.manualTaxValue),
    treatment: t.treatment,
    credit_mode: t.creditMode,
    credit_percent: num(t.creditPercent),
    credit_manual: num(t.creditManual),
    note: t.note ?? "",
  }));
  const venda = state.tributosVenda.map((t) => ({
    side: "venda" as const,
    tax_id: t.id,
    label: t.label,
    enabled: t.enabled,
    rate: num(t.rate),
    base_mode: t.baseMode,
    base_manual: num(t.baseManual),
    base_reduction: 0,
    use_manual_tax: false,
    manual_tax_value: 0,
    treatment: t.treatment,
    credit_mode: "nao",
    credit_percent: 0,
    credit_manual: 0,
    note: "",
  }));
  return [...compra, ...venda];
}

export function estadoPadraoDaEmpresa(defaults: unknown): SimulationState {
  const inicial = estadoInicial();
  if (!defaults || typeof defaults !== "object") return inicial;
  const d = defaults as Partial<SimulationState>;
  return {
    ...inicial,
    produto: { ...inicial.produto, ...(d.produto ?? {}) },
    venda: { ...inicial.venda, ...(d.venda ?? {}) },
  };
}

/**
 * Lista de campos que o usuário alterou em relação ao padrão recebido
 * (perfil tributário + valores padrão da empresa).
 */
export function camposAlterados(padrao: SimulationState, atual: SimulationState): string[] {
  const alterados: string[] = [];
  const comparar = (prefixo: string, a: Record<string, unknown>, b: Record<string, unknown>) => {
    for (const chave of Object.keys(b)) {
      if (JSON.stringify(a?.[chave]) !== JSON.stringify(b[chave])) alterados.push(`${prefixo}.${chave}`);
    }
  };
  comparar("produto", padrao.produto as never, atual.produto as never);
  comparar("venda", padrao.venda as never, atual.venda as never);
  for (const t of atual.tributosCompra) {
    const p = padrao.tributosCompra.find((x) => x.id === t.id);
    if (p && JSON.stringify(p) !== JSON.stringify(t)) alterados.push(`compra.${t.id}`);
  }
  for (const t of atual.tributosVenda) {
    const p = padrao.tributosVenda.find((x) => x.id === t.id);
    if (p && JSON.stringify(p) !== JSON.stringify(t)) alterados.push(`venda.${t.id}`);
  }
  return alterados;
}
