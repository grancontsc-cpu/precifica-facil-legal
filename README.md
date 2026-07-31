# Precifica Grancont

Simulador gerencial de precificação tributária brasileira. A aplicação abre direto no simulador e permite calcular preço de venda, custo líquido, créditos recuperáveis e margem efetiva, com perfis tributários versionados, comparação de fornecedores e relatórios exportáveis.

> Aplicação construída com [Lovable](https://lovable.dev) e sincronizada com este repositório de forma bidirecional.

## Principais módulos

- **Simulador completo** (`/app/simulador`) — formação de preço com tributos configuráveis por operação (entrada e saída), créditos integrais/parciais/manuais e cálculo reverso de margem.
- **Modo rápido** (`/app/rapido`) — assistente de 5 etapas com perguntas simples de regime, trajeto e impostos, com navegação livre entre etapas já visitadas.
- **Comparar fornecedores** — até 5 alternativas lado a lado, com desembolso, créditos, custo líquido, economia e limite de frete de equivalência.
- **Relatórios** — impressão, PDF, CSV e WhatsApp, com dados da empresa, produto, tributos e comparação.
- **Multiempresa** — organizações, papéis (Administrador Geral, gestor, usuário), convites, licenças e período de teste.
- **Administração** — licenças, solicitações de acesso, auditoria, e-mails, SEO e métricas de uso.

## Regras do domínio

- Nenhuma alíquota é fixada em código: tributos são configuráveis e versionados em perfis tributários.
- A situação fiscal nunca é inferida pelo NCM.
- Desembolso, crédito recuperável e custo líquido são sempre separados; alíquota não implica direito a crédito.
- Todas as fórmulas ficam no motor (`src/lib/pricing-engine.ts`); componentes de UI não calculam.
- Cálculo em decimal (`decimal.js`); arredondamento apenas na apresentação.
- Simulações salvas guardam cópias imutáveis (snapshots) das premissas usadas.

## Stack

- TanStack Start (React 19 + Vite) e TanStack Router/Query
- TypeScript, Tailwind CSS v4, Radix UI / shadcn
- Backend gerenciado (Postgres + Auth + server functions) com RLS multiempresa
- Vitest para a suíte de testes
- decimal.js para precisão numérica

## Rodando localmente

Requisitos: Node.js 20+ (ou Bun) e um gerenciador de pacotes.

```sh
git clone <url-deste-repositorio>
cd <pasta-do-repositorio>
npm install
cp .env.example .env   # preencha os valores
npm run dev
```

A aplicação sobe em `http://localhost:8080`.

## Variáveis de ambiente

Consulte `.env.example`. As variáveis `VITE_*` são públicas (usadas no navegador). Chaves privadas — como a chave de serviço do backend, `LOVABLE_API_KEY` e segredos de integrações — **não** ficam no repositório: elas são gerenciadas no painel do projeto e injetadas no ambiente do servidor.

## Testes

```sh
npm run test          # executa a suíte completa
npm run test:watch    # modo interativo
npm run lint          # ESLint
npm run typecheck     # verificação de tipos
```

O motor de precificação, a comparação de fornecedores, as regras de RLS e o fluxo de impostos do modo rápido são cobertos por testes unitários. Qualquer alteração no motor deve manter ou ampliar essa cobertura.

## Estrutura

```text
src/
  lib/            motor de precificação, regras fiscais, server functions e testes
  components/     UI (simulador, relatórios, app shell)
  routes/         rotas públicas, /app/* autenticadas e /admin/*
  integrations/   clientes do backend (gerados — não editar)
supabase/         migrações SQL do banco
```

## Banco de dados

As migrações SQL versionadas ficam em `supabase/migrations`. Os **dados** não são exportados pelo repositório; use a exportação de dados no painel do projeto quando precisar de um backup.

## Contribuindo

1. Crie um branch a partir do principal.
2. Rode `npm run lint`, `npm run typecheck` e `npm run test` antes de abrir o pull request.
3. Mantenha a interface em português brasileiro e responsiva.
