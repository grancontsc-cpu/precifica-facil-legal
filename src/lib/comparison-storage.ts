/**
 * Guarda a última comparação de fornecedores feita no navegador para que o
 * relatório da simulação possa incluí-la "quando existir".
 * Não contém cálculo — apenas persistência do resultado já calculado.
 */
import type { SupplierComparison } from "@/types/comparison";

const KEY = "precifica-grancont:comparacao";

interface Guardado {
  produto: string;
  salvoEm: string;
  comparacao: SupplierComparison;
}

const normalizar = (v: string) => v.trim().toLocaleLowerCase("pt-BR");

export function guardarComparacao(produto: string, comparacao: SupplierComparison) {
  if (typeof window === "undefined") return;
  if (comparacao.linhas.length < 2) return;
  try {
    const dados: Guardado = { produto, salvoEm: new Date().toISOString(), comparacao };
    localStorage.setItem(KEY, JSON.stringify(dados));
  } catch {
    // armazenamento indisponível — comparação simplesmente não é anexada
  }
}

/** Devolve a comparação salva quando ela é do mesmo produto. */
export function comparacaoSalva(produto: string): SupplierComparison | null {
  if (typeof window === "undefined") return null;
  try {
    const bruto = localStorage.getItem(KEY);
    if (!bruto) return null;
    const dados = JSON.parse(bruto) as Guardado;
    if (!dados?.comparacao?.linhas?.length) return null;
    if (!produto.trim() || !dados.produto?.trim()) return dados.comparacao;
    return normalizar(dados.produto) === normalizar(produto) ? dados.comparacao : null;
  } catch {
    return null;
  }
}
