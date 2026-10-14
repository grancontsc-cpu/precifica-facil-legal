import { etapasDoEstado, etapasReformaPadrao } from "@/lib/projecao-reforma";
import type { SimulationState } from "@/types/pricing";

export interface Pendencia {
  /** Identificador com o valor atual: se o valor mudar, a confirmação é refeita. */
  id: string;
  titulo: string;
  detalhe: string;
}

const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`;

/** Premissas de referência usadas na projeção da Reforma que o usuário ainda não confirmou. */
export function premissasReforma(state: SimulationState): Pendencia[] {
  const itens: Pendencia[] = [];
  const etapas = etapasDoEstado(state);
  const padrao = etapasReformaPadrao();
  const iguais = JSON.stringify(etapas) === JSON.stringify(padrao);
  const ultima = etapas[etapas.length - 1];
  const e2027 = etapas.find((e) => e.ano === "2027");

  if (ultima) {
    itens.push({
      id: `aliquotasPlenas:${ultima.cbs}:${ultima.ibs}`,
      titulo: `Alíquotas plenas em ${ultima.ano}: CBS ${pct(ultima.cbs)} e IBS ${pct(ultima.ibs)}`,
      detalhe: iguais
        ? "Valores de referência do sistema; as alíquotas definitivas ainda serão fixadas pelo Senado e pelos entes."
        : "Valores ajustados nesta simulação — confirme a fonte.",
    });
  }
  if (e2027) {
    itens.push({
      id: `cbs2027:${e2027.cbs}:${e2027.ibs}`,
      titulo: `2027: CBS ${pct(e2027.cbs)} e IBS ${pct(e2027.ibs)}`,
      detalhe: "CBS cheia com extinção de PIS/Cofins. A alíquota de referência pode ser ajustada por lei.",
    });
  }
  const fatores = etapas.map((e) => `${e.ano}:${e.fatorIcms}`).join(",");
  itens.push({
    id: `transicaoIcms:${fatores}`,
    titulo: "Redução do ICMS de 2029 a 2032 e extinção em 2033",
    detalhe: `ICMS mantido em ${etapas.map((e) => `${e.ano} ${e.fatorIcms}%`).join(", ")}.`,
  });

  const regime = state.operacao?.regime;
  if (regime === "simples" || regime === "mei") {
    const das = state.operacao?.aliquotaSimples ?? 0;
    itens.push({
      id: `aliquotaSimples:${das}`,
      titulo: `Alíquota efetiva do Simples Nacional: ${pct(das)}`,
      detalhe:
        das > 0
          ? "Confirme a alíquota efetiva pela receita bruta dos últimos 12 meses e o anexo da atividade."
          : "A alíquota do DAS está zerada — informe a alíquota efetiva da empresa.",
    });
    const modelo = state.operacao?.modeloSimples ?? "puro";
    itens.push({
      id: `modeloSimples:${modelo}`,
      titulo: `Simples Nacional ${modelo === "hibrido" ? "híbrido (IBS/CBS por fora)" : "puro (IBS/CBS dentro do DAS)"}`,
      detalhe: "A projeção mantém o mesmo DAS em todos os anos. Confirme a opção da empresa para 2027 em diante.",
    });
  }
  return itens;
}

export function pendentes(state: SimulationState): Pendencia[] {
  const ok = new Set(state.premissasConfirmadas ?? []);
  return premissasReforma(state).filter((p) => !ok.has(p.id));
}
