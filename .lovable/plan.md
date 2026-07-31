## Situação verificada agora

- A meta tag de verificação **está no ar** no site publicado (`https://precifica-facil-legal.lovable.app/`), com o token `ubZZVcdFG3gdMEA9ccegfi4H9YGjYXxiy71bmcYPplI`.
- `https://precifica-facil-legal.lovable.app/sitemap.xml` responde **200**.
- A única falha de SEO ainda aberta é `gsc:gsc` (Google Search Console não finalizado). As outras duas (H1 do login e sitemap) já estão marcadas como corrigidas.
- Importante: a verificação **ainda não foi concluída** — a publicação liberou o pré-requisito, mas a chamada de verificação ao Google ainda precisa ser feita.

## O que farei

1. **Confirmar a conexão** com o Google Search Console (reutilizando a conexão já autorizada; se ela não estiver mais válida, abro o card de conexão para você autorizar).
2. **Chamar a verificação META** do site `https://precifica-facil-legal.lovable.app/` reutilizando o token já publicado — sem gerar token novo e sem exigir nova publicação.
3. **Adicionar a propriedade** verificada à lista de sites do Search Console.
4. **Enviar o sitemap** `https://precifica-facil-legal.lovable.app/sitemap.xml` para a propriedade.
5. **Conferir o resultado** listando as propriedades e o status do sitemap, e então marcar a falha `gsc:gsc` como corrigida.
6. Se o Google responder `failedToFindMetaTag`, eu reinspeciono o HTML servido na raiz e reporto exatamente o que está faltando — sem trocar para verificação por DNS.

## Detalhes técnicos

- Fluxo via gateway do conector: `POST /siteVerification/v1/webResource?verificationMethod=META`, depois `PUT /webmasters/v3/sites/{siteUrl}` e `PUT /webmasters/v3/sites/{siteUrl}/sitemaps/{sitemapUrl}` (URLs codificadas no path).
- Nenhuma alteração de código é necessária: a tag já está em `src/routes/__root.tsx` e o sitemap já é servido por `src/routes/sitemap[.]xml.ts`.

## Depois

Os dados de desempenho (impressões, cliques, indexação) só aparecem no Search Console alguns dias após a verificação — a confirmação imediata será a propriedade verificada e o sitemap aceito.
