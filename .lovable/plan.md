# Corrigir o CI que falha no GitHub

## Por que está falhando

O e-mail do GitHub é do workflow "CI" (arquivo `.github/workflows/ci.yml`), que a cada push roda três verificações: **lint**, **verificação de tipos** e **testes**. O app funciona normalmente no preview porque o Vite não roda essas checagens — só o CI roda. Rodei as mesmas checagens agora e encontrei duas causas reais:

1. **Formatação (lint)** — o ESLint está configurado com o Prettier como regra de erro. Hoje **110 arquivos** estão fora do padrão de formatação, gerando **2.348 erros**. Nenhum deles é bug de lógica: são quebras de linha, vírgulas e indentação. Isso sozinho já derruba o job.

2. **Tipos (typecheck)** — **13 erros** em 12 arquivos, todos da mesma causa: a rota `/login` passou a exigir o parâmetro de busca `next` (`validateSearch`), mas links e redirecionamentos para `/login` espalhados pelo app (`AvisoLicenca`, `useApp`, `_authenticated/route`, `auth`, `cadastro`, `entrando`, `onboarding`, `recuperar-senha`, `acesso-negado`, `acesso-bloqueado`, `aguardando-aprovacao`, `confirmar-email`) não informam esse parâmetro.

Também vale ajustar o workflow: o projeto tem `bun.lock` e `package-lock.json` ao mesmo tempo, e o CI usa `npm ci`, que quebra sempre que o `package-lock.json` fica defasado em relação ao `package.json`.

## O que fazer

### 1. Normalizar a formatação
- Rodar o Prettier em todo o projeto (`prettier --write .`) e confirmar `eslint .` limpo.
- Nenhuma mudança de comportamento: só formatação.

### 2. Corrigir os 13 erros de tipo do `/login`
- Em cada link/redirecionamento para `/login`, passar `search: { next: undefined }` (ou o caminho de retorno correto, quando fizer sentido — por exemplo em `_authenticated/route.tsx` e `entrando.tsx`, onde faz sentido preservar a rota que o usuário tentou abrir).
- Manter o comportamento atual de retorno seguro (`destinoSeguro`).

### 3. Deixar o CI estável
- Alinhar o workflow ao gerenciador realmente usado: instalar com Bun (`oven-sh/setup-bun` + `bun install --frozen-lockfile`) e rodar `bun run lint`, `bun run typecheck`, `bun run test`.
- Manter só um lockfile como fonte de verdade para evitar o erro clássico de `npm ci` com lock defasado.

### 4. Validar
- Rodar localmente lint, typecheck e a suíte completa (267 testes) antes de subir, para o próximo push já sair verde.

## Detalhes técnicos

- Verificações rodadas: `npx eslint .` (2.348 erros, todos `prettier/prettier`), `tsc --noEmit` (13 erros: TS2741/TS2345, todos "Property 'search' is missing ... /login").
- Causa raiz dos tipos: `createFileRoute("/login")` com `validateSearch` torna `search` obrigatório em `<Link to="/login">`, `navigate({ to: "/login" })` e `redirect({ to: "/login" })`.
- Nada no motor de precificação (`src/lib/pricing-engine.ts`) é alterado; as regras fiscais e os testes permanecem intactos.
