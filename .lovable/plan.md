## Objetivo

Manter o `/sitemap.xml` sempre correto e reenviá-lo ao Google Search Console automaticamente, sem depender de eu rodar comandos manualmente.

## Estado atual (verificado)

- `src/routes/sitemap[.]xml.ts` já gera o sitemap dinamicamente, mas com uma lista **fixa** de 4 rotas (`/`, `/login`, `/cadastro`, `/recuperar-senha`).
- A propriedade já está verificada no Search Console e o sitemap já foi enviado uma vez (4 URLs, 0 erros).
- O conector Google Search Console está vinculado ao projeto, então o app pode chamar o gateway a partir do servidor.

## O que farei

### 1. Sitemap que acompanha o site sozinho
Trocar a lista fixa por uma derivação automática das rotas públicas a partir de `src/routeTree.gen.ts`, excluindo rotas privadas (`_authenticated`), rotas com parâmetros (`$`), redirecionamentos legados e páginas de estado (`/entrando`, `/acesso-negado`, `/teste-expirado`, etc.). Assim, criar ou remover uma página pública passa a refletir no sitemap sem edição manual.

### 2. Reenvio automático ao Google
- Endpoint público protegido por segredo: `src/routes/api/public/sitemap-ping.ts`. Ele valida um header secreto, chama o gateway do conector (`PUT /webmasters/v3/sites/{site}/sitemaps/{sitemap}`) e devolve o status retornado pelo Google.
- Agendamento diário via `pg_cron` + `pg_net` no backend, chamando esse endpoint na URL estável de produção.
- Como o Google ignora reenvios excessivos, o ping diário é seguro e garante que qualquer mudança publicada seja recoletada em até 24h.

### 3. Botão de reenvio imediato e status visível
Nova seção em `/admin/emails`… não — em uma aba nova **`/admin/seo`** (somente super_admin):
- Botão "Reenviar sitemap agora".
- Status lido ao vivo do Search Console: última submissão, último download pelo Google, nº de URLs enviadas/indexadas, avisos e erros.
- Link direto para abrir `/sitemap.xml`.

### 4. Testes
Testes unitários para a derivação de rotas do sitemap: inclui rotas públicas, exclui `_authenticated`, `$param`, splat e páginas de estado; e o XML gerado é válido.

## Detalhes técnicos

- Server function `src/lib/seo.functions.ts` com `reenviarSitemap` e `statusSitemap`, ambas com `requireSupabaseAuth` + checagem de super_admin via `access.server`.
- Chamadas ao gateway: `https://connector-gateway.lovable.dev/google_search_console/...` com `Authorization: Bearer LOVABLE_API_KEY` e `X-Connection-Api-Key: GOOGLE_SEARCH_CONSOLE_API_KEY`, lidas dentro do handler. A propriedade é resolvida listando `/webmasters/v3/sites` e escolhendo a verificada que cobre o domínio — nunca fixada no código.
- Segredo do cron: gero um valor aleatório e salvo como `SITEMAP_PING_SECRET`.

## Observação

O reenvio informa o Google; o momento da indexação continua sendo decisão dele (costuma levar dias).
