import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import { ExigePapel } from "@/components/app/GuardaAcesso";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { reenviarSitemap, statusSitemap } from "@/lib/seo.functions";

const TITULO = "SEO e sitemap — Precifica Grancont";
const DESCRICAO =
  "Acompanhe o envio do sitemap ao Google Search Console e reenvie manualmente quando publicar mudanças.";

export const Route = createFileRoute("/_authenticated/admin/seo")({
  head: () => ({
    meta: [
      { title: TITULO },
      { name: "description", content: DESCRICAO },
      { property: "og:title", content: TITULO },
      { property: "og:description", content: DESCRICAO },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <ExigePapel papel="super_admin">
      <PainelSeo />
    </ExigePapel>
  ),
});

function dataBr(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function Metrica({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="num-destaque mt-1 text-lg font-semibold">{valor}</p>
    </div>
  );
}

function PainelSeo() {
  const consultar = useServerFn(statusSitemap);
  const reenviar = useServerFn(reenviarSitemap);
  const queryClient = useQueryClient();

  const status = useQuery({
    queryKey: ["sitemap-status"],
    queryFn: () => consultar({}),
    retry: false,
  });

  const envio = useMutation({
    mutationFn: () => reenviar({}),
    onSuccess: (r) => {
      queryClient.setQueryData(["sitemap-status"], r);
      toast.success("Sitemap reenviado ao Google.");
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível reenviar o sitemap."),
  });

  const dados = status.data;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">SEO e sitemap</h1>
        <p className="text-sm text-muted-foreground">
          O sitemap é gerado automaticamente a partir das páginas públicas do sistema e reenviado ao Google todos os
          dias. Use o botão abaixo se quiser avisar o Google agora mesmo, logo após publicar uma mudança.
        </p>
      </header>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="size-4" aria-hidden /> Google Search Console
            </CardTitle>
            <CardDescription>
              {dados ? dados.propriedade : "Propriedade verificada do site publicado."}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => status.refetch()}
              aria-label="Atualizar status do sitemap"
            >
              <RefreshCw className="size-4" aria-hidden />
            </Button>
            <Button onClick={() => envio.mutate()} disabled={envio.isPending}>
              {envio.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Reenviar sitemap agora
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando status…</p>
          ) : status.isError ? (
            <p className="flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {(status.error as Error).message}
            </p>
          ) : dados ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={dados.erros > 0 ? "destructive" : "default"}>
                  {dados.erros > 0 ? `${dados.erros} erro(s)` : "Sem erros"}
                </Badge>
                {dados.pendente ? (
                  <Badge variant="secondary">Processando no Google</Badge>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
                    Processado
                  </span>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metrica rotulo="Último envio" valor={dataBr(dados.ultimoEnvio)} />
                <Metrica rotulo="Lido pelo Google" valor={dataBr(dados.ultimaLeitura)} />
                <Metrica rotulo="URLs enviadas" valor={String(dados.urlsEnviadas)} />
                <Metrica rotulo="URLs indexadas" valor={String(dados.urlsIndexadas)} />
              </div>

              {dados.avisos > 0 ? (
                <p className="text-sm text-muted-foreground">
                  O Google registrou {dados.avisos} aviso(s) neste sitemap.
                </p>
              ) : null}

              <a
                href="/sitemap.xml"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Abrir /sitemap.xml <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </>
          ) : null}

          <p className="text-xs leading-relaxed text-muted-foreground">
            A indexação em si continua sendo decisão do Google e costuma levar alguns dias após o envio.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
