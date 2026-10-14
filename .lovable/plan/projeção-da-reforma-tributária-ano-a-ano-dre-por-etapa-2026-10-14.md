# Projeção da Reforma Tributária ano a ano (DRE por etapa)

## O que o usuário vai ver
Quando a simulação estiver pronta no simulador completo, os resultados ganham uma nova aba, **"Impacto da Reforma"**. Ela mostra uma linha do tempo com as colunas Hoje, 2026, 2027, 2028, 2029, 2030, 2031, 2032 e 2033 e três blocos:

1. **DRE por unidade, mantendo o preço de hoje**
   Receita (preço cobrado) → (−) tributos sobre a venda → Receita líquida → (−) custo líquido da mercadoria (já descontados os créditos) → (−) despesas variáveis e fixas → **Lucro por unidade (R$)** e **Margem (%)**.
   Em destaque: **"Quanto você perde de lucro se não mexer no preço"**, em R$ e em pontos percentuais.

2. **Preço necessário para manter o lucro em R$ de hoje**
   Novo preço por ano, aumento em R$ e em %.

3. **Preço necessário para manter a margem % de hoje**
   Novo preço por ano, aumento em R$ e em %.

Cartões de resumo no topo trazem o ano de maior impacto e o aumento necessário em 2027 e em 2033. Um gráfico simples mostra o lucro com o preço atual e o preço necessário ao longo dos anos.

Uma tabela editável de alíquotas por ano fica recolhida. Ela vem preenchida com a referência e qualquer alíquota pode ser ajustada. Ao mudar um valor, a projeção é recalculada.

A mesma projeção (DRE + os dois cenários) entra no **relatório exportado** (impressão/PDF, CSV e o resumo para WhatsApp).

## Regras de cada etapa (referência editável)
| Ano | CBS | IBS | PIS/Cofins | ICMS |
|---|---|---|---|---|
| Hoje | — | — | como informado | como informado |
| 2026 | 0,9% informativo | 0,1% informativo | mantidos | 100% |
| 2027–2028 | 8,8% por fora | 0,1% por fora | extintos | 100% |
| 2029 | 8,8% | 10% de 17,7% | extintos | 90% da alíquota |
| 2030 | 8,8% | 20% de 17,7% | extintos | 80% |
| 2031 | 8,8% | 30% de 17,7% | extintos | 70% |
| 2032 | 8,8% | 40% de 17,7% | extintos | 60% |
| 2033 | 8,8% | 17,7% pleno | extintos | extinto |

- **O que vem da simulação:** o "hoje" é exatamente a simulação feita: preço, margem, despesas, regime, Simples Puro/Híbrido e fornecedor.
- **Etapas reprocessadas:** o mesmo produto é recalculado em cada etapa, compra e venda. O custo líquido muda junto, porque os créditos de IBS/CBS e a queda do ICMS também afetam a compra.
- **Créditos:** seguem as regras já existentes (Real, Presumido e Simples Híbrido creditam; Simples Puro e MEI, não).
- **Preço comparado:** o "preço" é o valor total cobrado do cliente. A tela também mostra o preço antes dos tributos por fora, porque IBS e CBS passam a ser cobrados por fora.

## Detalhes técnicos
- **Motor:** novo módulo `src/lib/projecao-reforma.ts`, com fórmulas só no motor e Decimal.js:
  - `etapasReformaPadrao()`: tabela por ano editável. Fica fora do código fixo, como sugestão inicial.
  - `estadoDaEtapa(state, etapa)`: deriva o estado do ano a partir de `aplicarMarcoTemporal` e ajusta o fator do ICMS (compra, venda e fronteira) e a fração do IBS.
  - `projetarReforma(state, etapas)`:
    - mantendo o preço: `avaliarPreco` com o preço final de hoje;
    - mantendo o lucro em R$: busca binária reaproveitando `resolverPrecoPorPrecoFinal`/núcleo de venda;
    - mantendo a margem %: `resolverPrecoPorMargem`.
  - Arredondamento só na exibição.
- **Tela:** componente `src/components/pricing/ProjecaoReforma.tsx`, ligado às abas de resultado em `simulador.tsx`. Tabela rolável no celular, com a primeira coluna fixa.
- **Relatório:** nova seção em `src/lib/report.ts` e em `RelatorioSimulacao.tsx`, mais as linhas no CSV e no texto do WhatsApp.
- **Sem mudança no banco:** a projeção é derivada da simulação. Simulações salvas a reproduzem ao abrir.
- **Testes:** `src/lib/projecao-reforma.test.ts` cobre:
  - preço mantido em 2027 no Lucro Real (lucro e margem esperados);
  - preço para manter R$ e % (o lucro e a margem resultantes batem com os de hoje);
  - a fração do ICMS e do IBS de 2029 a 2032;
  - Simples Puro × Híbrido;
  - edição de alíquota alterando o resultado.
  - Por fim, rodar `bun run verificar`.
