# Análise do estado do projeto após as alterações no outro editor

## Resumo

O código em si está saudável: **tipos OK** e **309 testes passando** (21 arquivos). O que está quebrado é apenas a checagem de formatação, e ela quebra o CI.

## O que encontrei

1. **Lint falhando com 1.256 erros — todos de formatação (`prettier/prettier`).**
   Não é código errado. O `bun install` feito no outro editor subiu o Prettier de 3.7 para 3.8 (o `package.json` permite `^3.7.3`). A versão 3.8 mudou o estilo de quebra de linha de tipos union (ex.: `"icms" | "pis" | ...`), então centenas de arquivos ficaram "fora do padrão" sem ninguém ter mexido neles. Como `verificar` roda lint antes de tipos e testes, o CI para logo no começo.

2. **Dois lockfiles no repositório.** Foi criado um `package-lock.json` (npm) ao lado do `bun.lock`. O CI usa `bun install --frozen-lockfile`; manter os dois convida divergência de versões entre a sua máquina, o outro editor e o CI.

3. **2 avisos de `eslint-disable` inútil** em `src/lib/analytics-eventos.test.ts` e `src/routes/_authenticated/simulador.tsx` (as regras desativadas não acusam mais nada).

4. **Aviso de hidratação na tela `/login`** aparecendo no preview (o HTML do servidor não bate com o do cliente na `<main>` do login). Não derruba a página — o React refaz a árvore no cliente — mas polui o console e custa performance.

5. **`CLAUDE.md` aponta para um grafo `graphify-out/` que não existe no repositório.** As instruções dizem para consultar `graphify-out/graph.json` e rodar `graphify update .`, mas essa pasta não está versionada aqui.

## O que proponho fazer

1. **Fixar a versão do Prettier** em `package.json` (`"prettier": "3.8.3"`, sem `^`) para que sua máquina, o outro editor e o CI usem exatamente o mesmo formatador, e reformatar o repositório inteiro com `bun run format`. Isso zera os 1.256 erros de uma vez.
2. **Remover o `package-lock.json`** e adicioná-lo ao `.gitignore`, deixando o `bun.lock` como fonte única de verdade (como o CI já espera).
3. **Remover os 2 `eslint-disable` obsoletos.**
4. **Investigar e corrigir o aviso de hidratação do `/login`**, localizando o trecho que renderiza diferente no servidor e no cliente.
5. **Ajustar o `CLAUDE.md`** para não instruir o uso de um grafo ausente (ou marcar a seção como opcional/local), evitando instruções que não funcionam neste repositório.
6. **Rodar `bun run verificar`** ao final e confirmar lint + tipos + 309 testes verdes.

## Detalhes técnicos

- Causa raiz da enxurrada de erros: alteração de formatação de union types no Prettier 3.8 combinada com o range `^3.7.3`; nenhum arquivo de regra (`.prettierrc`) mudou.
- O commit `4da2ed7` já normalizou fim de linha via `.gitattributes` (`* text=auto eol=lf`) — isso está correto e não é a causa.
- Nenhuma alteração no motor de precificação, RLS ou migrações será feita neste ajuste.
