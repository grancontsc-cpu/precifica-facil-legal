import { tributosCompraPadrao } from "@/lib/pricing-defaults";
import type { PurchaseTax, PurchaseTaxId } from "@/types/pricing";
import type { SupplierAlternative } from "@/types/comparison";

export const REGIMES: Array<{ id: SupplierAlternative["regime"]; label: string }> = [
  { id: "naoInformado", label: "Não informado" },
  { id: "simples", label: "Simples Nacional" },
  { id: "presumido", label: "Lucro Presumido" },
  { id: "real", label: "Lucro Real" },
  { id: "mei", label: "MEI" },
  { id: "produtorRural", label: "Produtor rural" },
];

let contador = 0;
export function novoId() {
  contador += 1;
  return `alt-${Date.now().toString(36)}-${contador}`;
}

export function alternativaVazia(overrides: Partial<SupplierAlternative> = {}): SupplierAlternative {
  return {
    id: novoId(),
    nome: "",
    uf: "",
    regime: "naoInformado",
    prazoDias: 0,
    valorUnitario: 0,
    quantidade: 1,
    descontoTotal: 0,
    freteTotal: 0,
    seguroTotal: 0,
    outrasDespesas: 0,
    tributos: tributosCompraPadrao(),
    observacao: "",
    ...overrides,
  };
}

function ajustar(
  tributos: PurchaseTax[],
  patches: Partial<Record<PurchaseTaxId, Partial<PurchaseTax>>>,
): PurchaseTax[] {
  return tributos.map((t) => (patches[t.id] ? { ...t, ...patches[t.id] } : t));
}

/** Exemplo inicial pedido pelo cliente: fornecedor RJ x fornecedor BA. */
export function exemploComparacao(): SupplierAlternative[] {
  const base = tributosCompraPadrao();
  return [
    alternativaVazia({
      nome: "Fornecedor RJ",
      uf: "RJ",
      regime: "real",
      valorUnitario: 48,
      quantidade: 1,
      prazoDias: 30,
      tributos: ajustar(base, {
        icms: { enabled: true, rate: 7, treatment: "incluido", creditMode: "integral" },
        pis: { enabled: true, rate: 0, treatment: "incluido", creditMode: "integral" },
        cofins: { enabled: true, rate: 0, treatment: "incluido", creditMode: "integral" },
      }),
    }),
    alternativaVazia({
      nome: "Fornecedor BA",
      uf: "BA",
      regime: "real",
      valorUnitario: 62,
      quantidade: 1,
      prazoDias: 30,
      tributos: ajustar(tributosCompraPadrao(), {
        icms: { enabled: true, rate: 20.5, treatment: "incluido", creditMode: "integral" },
        pis: { enabled: true, rate: 0, treatment: "incluido", creditMode: "integral" },
        cofins: { enabled: true, rate: 0, treatment: "incluido", creditMode: "integral" },
      }),
    }),
  ];
}
