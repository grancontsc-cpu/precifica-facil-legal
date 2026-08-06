import type { NotaPrecificada, PremissasVenda } from "./para-simulacao";
import type { Regime } from "@/types/pricing";

/** Chave estável de um item dentro do lote importado. */
export function chaveItem(notaId: string, numeroItem: number | string): string {
  return `${notaId}#${numeroItem}`;
}

export interface PrecoItemVersao {
  chave: string;
  descricao: string;
  quantidade: number;
  custoLiquidoUnitario: number;
  precoFinal: number | null;
  margemEfetiva: number | null;
}

export interface VersaoLote {
  id: string;
  rotulo: string;
  criadaEm: string;
  regime: Regime;
  fronteiraAtiva: boolean;
  premissas: PremissasVenda;
  itens: PrecoItemVersao[];
  totais: {
    desembolso: number;
    creditos: number;
    custoLiquido: number;
    receitaSugerida: number;
    resultadoSugerido: number;
  };
}

export interface OpcoesVersao {
  id: string;
  rotulo: string;
  criadaEm: string;
  regime: Regime;
  fronteiraAtiva: boolean;
  premissas: PremissasVenda;
}

/** Congela o resultado atual do lote como uma versão comparável (somente leitura). */
export function criarVersao(calculadas: NotaPrecificada[], opcoes: OpcoesVersao): VersaoLote {
  const itens: PrecoItemVersao[] = [];
  const totais = {
    desembolso: 0,
    creditos: 0,
    custoLiquido: 0,
    receitaSugerida: 0,
    resultadoSugerido: 0,
  };

  for (const calc of calculadas) {
    totais.desembolso += calc.totais.desembolso;
    totais.creditos += calc.totais.creditos;
    totais.custoLiquido += calc.totais.custoLiquido;
    totais.receitaSugerida += calc.totais.receitaSugerida;
    totais.resultadoSugerido += calc.totais.resultadoSugerido;

    for (const { item, resultado } of calc.itens) {
      itens.push({
        chave: chaveItem(calc.nota.id, item.numero),
        descricao: item.descricao,
        quantidade: item.quantidade,
        custoLiquidoUnitario: resultado.compra.custoLiquidoUnitario,
        precoFinal: resultado.recomendado?.precoFinal ?? null,
        margemEfetiva: resultado.recomendado?.margemEfetiva ?? null,
      });
    }
  }

  return { ...opcoes, itens, totais, premissas: { ...opcoes.premissas } };
}

export interface ComparacaoItem {
  chave: string;
  anterior: PrecoItemVersao | null;
  precoAnterior: number | null;
  precoAtual: number | null;
  variacaoAbsoluta: number | null;
  variacaoPercentual: number | null;
  margemAnterior: number | null;
  margemAtual: number | null;
  variacaoMargem: number | null;
}

/** Compara o preço sugerido atual de um item com o registrado em uma versão anterior. */
export function compararItem(
  versao: VersaoLote | null,
  chave: string,
  precoAtual: number | null,
  margemAtual: number | null,
): ComparacaoItem {
  const anterior = versao?.itens.find((i) => i.chave === chave) ?? null;
  const precoAnterior = anterior?.precoFinal ?? null;
  const margemAnterior = anterior?.margemEfetiva ?? null;
  const temAmbos = precoAnterior !== null && precoAtual !== null;
  const variacaoAbsoluta = temAmbos ? precoAtual - precoAnterior : null;
  return {
    chave,
    anterior,
    precoAnterior,
    precoAtual,
    variacaoAbsoluta,
    variacaoPercentual:
      temAmbos && precoAnterior !== 0 ? ((precoAtual - precoAnterior) / precoAnterior) * 100 : null,
    margemAnterior,
    margemAtual,
    variacaoMargem:
      margemAnterior !== null && margemAtual !== null ? margemAtual - margemAnterior : null,
  };
}

/** Lista as premissas que mudaram entre a versão comparada e as premissas atuais. */
export function diferencasPremissas(
  versao: VersaoLote,
  premissas: PremissasVenda,
  regime: Regime,
  fronteiraAtiva: boolean,
): { campo: string; anterior: number | string | boolean; atual: number | string | boolean }[] {
  const lista: { campo: string; anterior: number | string | boolean; atual: number | string }[] =
    [];
  if (versao.regime !== regime)
    lista.push({ campo: "Regime", anterior: versao.regime, atual: regime });
  const chaves = Object.keys(premissas) as (keyof PremissasVenda)[];
  for (const c of chaves) {
    if (versao.premissas[c] !== premissas[c]) {
      lista.push({ campo: c, anterior: versao.premissas[c], atual: premissas[c] });
    }
  }
  const saida: {
    campo: string;
    anterior: number | string | boolean;
    atual: number | string | boolean;
  }[] = [...lista];
  if (versao.fronteiraAtiva !== fronteiraAtiva) {
    saida.push({
      campo: "ICMS de fronteira",
      anterior: versao.fronteiraAtiva,
      atual: fronteiraAtiva,
    });
  }
  return saida;
}
