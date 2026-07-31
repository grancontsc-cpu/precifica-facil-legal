## Objetivo

Tirar o simulador da premissa "só Lucro Real": passar a considerar o **regime tributário** da empresa e o **estado de origem da mercadoria**, calculando automaticamente o **ICMS fronteira (DIFAL/antecipação)** e tratando-o como **crédito** (Presumido/Real) ou **custo puro** (Simples/MEI). Além disso, criar um terceiro modo **Rápido**, ultra enxuto.

## 1. Tabelas de alíquotas (configuráveis e versionadas)

Nada de alíquota no código. Duas tabelas novas no banco, com vigência (`vigencia_inicio`/`vigencia_fim`) e edição restrita ao Administrador Geral:

- `icms_aliquotas_internas` — UF, alíquota interna, FCP padrão, observação.
- `icms_aliquotas_interestaduais` — UF origem, UF destino, alíquota (regra 7% / 12% / 4% para importado).

Seed inicial com os valores vigentes hoje, cada linha marcada com a data de vigência e a fonte. Tela `/admin/aliquotas` para conferir e atualizar, com histórico (versão anterior nunca é apagada — simulações salvas continuam apontando para o snapshot usado).

## 2. Cadastro da empresa

Os campos já existem no banco (`cnpj`, `uf`, `regime`) mas não são preenchidos na tela. Passam a ser pedidos e obrigatórios em `/empresas` e no onboarding:

- CNPJ (com máscara e validação de dígito verificador)
- UF da empresa (estado de destino padrão das compras)
- Regime: **Simples Nacional · Lucro Presumido · Lucro Real · MEI**
- Contribuinte de ICMS (sim/não)

O regime e a UF viram os valores padrão de toda simulação nova.

## 3. Regras do motor de precificação

Tudo em `src/lib/pricing-engine.ts` (nenhuma fórmula na UI), com Decimal.

**Entrada nova na simulação:** `regime`, `ufOrigem`, `ufDestino`, `finalidade: "revenda"`, `mercadoriaImportada` (define os 4%).

**ICMS fronteira (entrada):**
```text
base            = valor dos produtos líquido (ou base manual)
icmsOrigem      = base × aliquotaInterestadual(ufOrigem → ufDestino)
icmsDestino     = base × aliquotaInterna(ufDestino)
difal           = max(0; icmsDestino − icmsOrigem)
```
- Mesma UF de origem e destino → difal = 0 (operação interna, sem fronteira).
- **Lucro Real / Presumido:** difal entra como desembolso "por fora" **com crédito integral** → não vira custo.
- **Simples Nacional / MEI:** difal entra como desembolso "por fora" **sem crédito** → **custo puro** que sobe o custo líquido unitário.
- Sempre editável: o usuário pode sobrescrever a alíquota, a base ou o valor destacado, e pode desligar o cálculo automático.

**Créditos na entrada por regime:**
- Simples / MEI: ICMS, PIS, Cofins e IPI da compra entram **sem crédito** por padrão (custo).
- Presumido: PIS/Cofins cumulativos → sem crédito; ICMS com crédito.
- Real: comportamento atual (créditos integrais por padrão).
Todos continuam ajustáveis manualmente — o padrão é sugestão, não trava.

**Tributos na venda por regime:**
- Simples / MEI: um único tributo "DAS – Simples Nacional", **alíquota efetiva digitada pelo usuário**, tratamento "incluído" no preço, sem crédito. Os tributos de venda separados (ICMS/PIS/Cofins) ficam desativados.
- Presumido / Real: comportamento atual.
A margem, o preço mínimo e o cálculo reverso passam a considerar o DAS dentro do núcleo de venda existente (`nucleoVenda`), sem duplicar fórmula.

## 4. Modo Rápido (terceira tela)

Modos passam a ser **Rápido · Simples · Completo**, na mesma barra que já existe.

O modo Rápido mostra apenas: nome do produto, valor de compra, quantidade, UF de origem, UF de destino (pré-preenchida com a da empresa), regime (pré-preenchido) e margem desejada. Resultado em um único cartão: **desembolso · créditos · custo líquido · preço sugerido · ICMS fronteira**.

Aviso permanente e visível: *"Valor aproximado — baseado nas alíquotas gerais por estado, sem benefícios fiscais, substituição tributária, redução de base ou MVA. Para precisão, use o modo Simples ou Completo."* Botão "Refinar no modo Completo" que leva os mesmos dados para a tela cheia, sem perder nada.

## 5. Validações

- CNPJ inválido, UF não informada, regime não escolhido.
- Alíquota efetiva do Simples fora de 0–33% → aviso.
- Falta de alíquota vigente para o par origem/destino → erro claro em vez de cálculo silencioso errado.
- DIFAL negativo (origem maior que destino) → zerado, com nota explicativa.
- Alerta quando o regime da simulação diverge do regime cadastrado da empresa.

## 6. Testes

Novos casos somados aos 185 existentes:
- DIFAL SP→BA, RJ→BA, BA→BA (zero), importado 4%.
- Mesmo cenário em Real (crédito) vs Simples (custo) → custo líquido diferente, comprovando o efeito.
- Simples com DAS incluído: preço mínimo, margem efetiva e cálculo reverso batendo.
- MEI sem crédito nenhum.
- Alíquota ausente/vigência expirada → erro esperado.
- Snapshot: simulação salva mantém as alíquotas usadas mesmo depois de a tabela ser atualizada.
- Modo Rápido: mesmos números que o modo Completo com as mesmas entradas.

## Detalhes técnicos

Arquivos afetados: migração nova (2 tabelas + seed + RLS/GRANTs), `src/types/pricing.ts`, `src/lib/pricing-engine.ts`, `src/lib/pricing-defaults.ts`, `src/lib/aliquotas.ts` + `aliquotas.functions.ts` (novos), `src/routes/_authenticated/simulador.tsx`, `src/components/pricing/AlternadorModo.tsx`, novo `ModoRapido.tsx`, `/empresas`, `/onboarding` e `/admin/aliquotas`. Relatórios e comparação de fornecedores passam a exibir o ICMS fronteira e o regime.
