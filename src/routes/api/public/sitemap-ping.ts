import { createFileRoute } from "@tanstack/react-router";

/**
 * Endpoint chamado pelo agendador diário para reenviar o sitemap ao Google.
 * Protegido por segredo compartilhado — não expõe nenhum dado do sistema.
 */
export const Route = createFileRoute("/api/public/sitemap-ping")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const segredo = process.env["SITEMAP_PING_SECRET"];
        if (!segredo) {
          return Response.json({ ok: false, erro: "Agendamento não configurado." }, { status: 503 });
        }

        const enviado = request.headers.get("x-sitemap-ping-secret") ?? "";
        if (enviado.length !== segredo.length) {
          return Response.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
        }
        let diferenca = 0;
        for (let i = 0; i < segredo.length; i += 1) {
          diferenca |= enviado.charCodeAt(i) ^ segredo.charCodeAt(i);
        }
        if (diferenca !== 0) {
          return Response.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
        }

        try {
          const { submeterSitemap } = await import("@/lib/seo.server");
          const status = await submeterSitemap();
          return Response.json({ ok: true, status });
        } catch (erro) {
          const mensagem = erro instanceof Error ? erro.message : "Falha ao reenviar o sitemap.";
          console.error("sitemap-ping falhou:", mensagem);
          return Response.json({ ok: false, erro: mensagem }, { status: 502 });
        }
      },
    },
  },
});
