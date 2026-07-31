import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Mail, RefreshCw, XCircle, MinusCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ExigePapel } from "@/components/app/GuardaAcesso";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  executarTesteEmailPontaAPonta,
  listarEventosEmail,
  type ResultadoTesteEmail,
} from "@/lib/email-diagnostico.functions";

const TITULO = "Diagnóstico de e-mails — Precifica Grancont";
const DESCRICAO =
  "Execute o teste de ponta a ponta dos e-mails de confirmação e recuperação e acompanhe o histórico de envios.";

export const Route = createFileRoute("/_authenticated/admin/emails")({
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
      <PainelEmails />
    </ExigePapel>
  ),
});

const ROTULO_TIPO: Record<string, string> = {
  cadastro_solicitado: "Cadastro solicitado",
  confirmacao_enviada: "Confirmação enviada",
  confirmacao_reenviada: "Confirmação reenviada",
  confirmacao_concluida: "Confirmação concluída",
  recuperacao_solicitada: "Recuperação solicitada",
  senha_criada: "Senha criada",
  senha_redefinida: "Senha redefinida",
  teste_conta_preparada: "Teste · conta preparada",
  teste_confirmacao_enviada: "Teste · link de confirmação",
  teste_confirmacao_concluida: "Teste · confirmação validada",
  teste_link_expirado: "Teste · expiração do link",
  teste_recuperacao_enviada: "Teste · link de recuperação",
  teste_recuperacao_validada: "Teste · recuperação validada",
  teste_recuperacao_expirada: "Teste · expiração da recuperação",
  teste_reenvio_primeiro: "Teste · 1º reenvio",
  teste_reenvio_cooldown: "Teste · cooldown do reenvio",
  teste_conta_removida: "Teste · limpeza",
};

function dataBr(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
}

function IconeStatus({ status }: { status: string }) {
  if (status === "ok") return <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />;
  if (status === "erro") return <XCircle className="size-4 text-destructive" aria-hidden />;
  return <MinusCircle className="size-4 text-muted-foreground" aria-hidden />;
}

function PainelEmails() {
  const listar = useServerFn(listarEventosEmail);
  const testar = useServerFn(executarTesteEmailPontaAPonta);
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [filtro, setFiltro] = useState("");
  const [resultado, setResultado] = useState<ResultadoTesteEmail | null>(null);

  const eventos = useQuery({
    queryKey: ["email-events", filtro],
    queryFn: () => listar({ data: { limite: 100, email: filtro || undefined } }),
  });

  const teste = useMutation({
    mutationFn: (alvo: string) => testar({ data: { email: alvo } }),
    onSuccess: (r) => {
      setResultado(r);
      setFiltro(r.email);
      queryClient.invalidateQueries({ queryKey: ["email-events"] });
      toast[r.aprovado ? "success" : "error"](
        r.aprovado ? "Teste concluído sem falhas." : "O teste encontrou falhas. Veja os passos abaixo.",
      );
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível executar o teste."),
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Diagnóstico de e-mails</h1>
        <p className="text-sm text-muted-foreground">
          Teste o ciclo completo (confirmação, recuperação, expiração dos links e cooldown de reenvio) com um endereço
          controlado. Cada passo fica registrado no histórico abaixo.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="size-4" aria-hidden /> Teste de ponta a ponta
          </CardTitle>
          <CardDescription>
            Use um endereço que você controla. Se a conta não existir, ela é criada apenas para o teste e removida ao
            final.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (!email.trim()) return;
              teste.mutate(email.trim().toLowerCase());
            }}
          >
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="email-teste">E-mail controlado</Label>
              <Input
                id="email-teste"
                type="email"
                autoComplete="off"
                placeholder="voce+teste@suaempresa.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={teste.isPending}>
              {teste.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Executar teste
            </Button>
          </form>

          {resultado ? (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={resultado.aprovado ? "default" : "destructive"}>
                  {resultado.aprovado ? "Aprovado" : "Com falhas"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {resultado.email} · {dataBr(resultado.iniciadoEm)}
                </span>
                <code className="text-xs text-muted-foreground">{resultado.referencia}</code>
              </div>
              <ol className="space-y-2">
                {resultado.passos.map((p) => (
                  <li key={p.chave} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5">
                      <IconeStatus status={p.status} />
                    </span>
                    <span>
                      <span className="font-medium">{p.titulo}</span>{" "}
                      <span className="text-muted-foreground">({p.duracaoMs} ms)</span>
                      <br />
                      <span className="text-muted-foreground">{p.detalhe}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Histórico de e-mails</CardTitle>
            <CardDescription>Últimos 100 eventos registrados no sistema.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Input
              className="w-56"
              placeholder="Filtrar por e-mail"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value.trim().toLowerCase())}
            />
            <Button variant="outline" size="icon" onClick={() => eventos.refetch()} aria-label="Atualizar histórico">
              <RefreshCw className="size-4" aria-hidden />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {eventos.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (eventos.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Quando</th>
                    <th className="py-2 pr-3 font-medium">Evento</th>
                    <th className="py-2 pr-3 font-medium">E-mail</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {eventos.data?.map((ev) => (
                    <tr key={ev.id} className="border-t align-top">
                      <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{dataBr(ev.criadoEm)}</td>
                      <td className="py-2 pr-3">{ROTULO_TIPO[ev.tipo] ?? ev.tipo}</td>
                      <td className="py-2 pr-3">{ev.email ?? "—"}</td>
                      <td className="py-2 pr-3">
                        <span className="inline-flex items-center gap-1.5">
                          <IconeStatus status={ev.status} />
                          {ev.status}
                        </span>
                      </td>
                      <td className="py-2 text-muted-foreground">{ev.mensagemErro ?? ev.codigoErro ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
