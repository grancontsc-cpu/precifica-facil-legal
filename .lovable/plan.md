## Objetivo

Padronizar as metatags de SEO e compartilhamento: defaults corretos no `<head>` raiz, e um padrão único aplicado a todas as rotas (inclusive as que hoje não têm nenhuma metatag).

## Situação atual (verificada)

- O `__root.tsx` já tem `charSet`, `viewport`, título, descrição, `og:type` e `twitter:card`, mas **não tem** `og:site_name`, `og:locale`, `og:title`/`og:description` e nenhum JSON-LD.
- Nenhuma rota do projeto tem `canonical` nem `og:url` — os dois só existem hoje no sitemap.
- 5 rotas não têm `head()` nenhum: `auth`, `cadastrar`, `esqueci-minha-senha`, `aceitar-convite`, `app.index` e `app.$` — herdam o título genérico do root.
- As demais rotas públicas já seguem um formato consistente (título, descrição, og:title/og:description, twitter:card, `robots: noindex` nas telas de fluxo).

## O que será feito

**1. Metatags raiz (`src/routes/__root.tsx`)**
- Manter charset, viewport, verificação do Google e fontes.
- Acrescentar defaults sitewide: `og:site_name` ("Precifica Grancont"), `og:locale` ("pt_BR"), `og:title` e `og:description` iguais ao título/descrição padrão, `theme-color`.
- Manter `og:type: website` no root e **não** colocar canonical nem `og:image` no root (o root é concatenado em todas as rotas e sobrescreveria as filhas).
- Adicionar JSON-LD sitewide de `SoftwareApplication`/`Organization` (Grancont, categoria financeira/contábil, idioma pt-BR).

**2. Helper único de metatags (`src/lib/seo-head.ts`)**
- Função `metaPagina({ titulo, descricao, caminho, indexavel })` que devolve o array de `meta` + `links` já com: título, description, `og:title`, `og:description`, `og:url` autorreferente, `twitter:card`, `twitter:title`, `twitter:description`, `robots: noindex, nofollow` quando não indexável, e `canonical` apenas na rota folha.
- Base de URL: `https://precifica-facil-legal.lovable.app`.

**3. Aplicar o helper em todas as rotas**
- Rotas indexáveis: `/` (simulador), `/login`, `/cadastro`, `/recuperar-senha`.
- Rotas de fluxo/privadas (noindex): `confirmar-email`, `redefinir-senha`, `onboarding`, `teste-expirado`, `licenca-suspensa`, `acesso-negado`, `acesso-bloqueado`, `aguardando-aprovacao`, `entrando`, `aceitar-convite`, `auth`, `cadastrar`, `esqueci-minha-senha`, `app.index`, `app.$` e as rotas sob `_authenticated` que hoje repetem o bloco à mão.
- Cada rota mantém título e descrição próprios em português; nenhuma passa a usar texto genérico.

**4. Consistência com o sitemap**
- Conferir que só as rotas indexáveis (as mesmas 4 acima) entram no `sitemap.xml`, para não anunciar páginas marcadas como `noindex`.

## Detalhes técnicos

- Padrão TanStack: `title` vai dentro do array `meta`; `canonical` vai em `links` só na rota folha (o router concatena `links` sem deduplicar).
- Sem `og:image`: hoje não existe imagem de capa própria; a plataforma injeta a prévia automática. Se quiser uma arte de compartilhamento com a logo Grancont, digo e gero depois — a prévia antiga fica em cache nos crawlers por algum tempo.
- Verificação: `tsgo --noEmit`, suíte de testes (219) e leitura do HTML servido para confirmar as tags renderizadas no SSR.
