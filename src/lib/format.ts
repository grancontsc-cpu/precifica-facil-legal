/** Formatação e parsing no padrão brasileiro. Nunca usado dentro do motor. */

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numero = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return moeda.format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${numero.format(value)}%`;
}

export function formatNumero(value: number | null | undefined, casas = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(value);
}

export function formatQuantidade(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(value);
}

export function formatData(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Aceita vírgula ou ponto e devolve um número normalizado. */
export function parseNumeroBR(input: string): number {
  if (input === null || input === undefined) return 0;
  const limpo = String(input)
    .replace(/[^\d,.-]/g, "")
    .trim();
  if (!limpo || limpo === "-") return 0;

  const temVirgula = limpo.includes(",");
  const temPonto = limpo.includes(".");
  let normalizado = limpo;

  if (temVirgula && temPonto) {
    // Formato brasileiro: ponto é separador de milhar.
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else if (temVirgula) {
    normalizado = limpo.replace(",", ".");
  }

  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}
