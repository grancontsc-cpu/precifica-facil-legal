import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, RefreshCw, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ExigePapel } from "@/components/app/GuardaAcesso";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { metaPagina } from "@/lib/seo-head";

const TITULO = "Métricas de uso — Precifica Grancont";
const DESCRICAO =
  "Painel interno com sessões, usuários e eventos principais da precificação por período.";

export const Route = createFileRoute("/_authenticated/admin/metricas")({
  head: () => ({
    ...metaPagina({ titulo: TITULO, descricao: DESCRICAO, caminho: "/admin/metricas" }),
  }),
  component: () => (
    <ExigePapel papel="super_admin">
      <PainelMetricas />
    </ExigePapel>
  ),
});

/** Rótulos amigáveis dos eventos do produto. */
const ROTULOS: Record<string, string> = {
  simulacao_iniciada: "Início de simulação",
  simulacao_concluida: "Simulação concluída",
  simular: "Pedido de cálculo",
  parametro_fiscal_alterado: "Ajuste de parâmetro fiscal",
  exportar_relatorio: "Exportação de relatório",
  copiar_resultado: "Cópia do resultado",
};

const PRINCIPAIS = ["simulacao_iniciada", "simulacao_concluida", "exportar_relatorio"];

interface LinhaEvento {
  evento: string;
  total: number;
  sessoes: number;
  usuarios: number;
}
interface LinhaModo {
  modo: string;
  total: number;
}
interface LinhaSerie {
  dia: string;
  sessoes: number;
  usuarios: number;
  iniciadas: number;
  concluidas: number;
  exportacoes: number;
}
interface Metricas {
  dias: number;
  sessoes: number;
  usuarios: number;
  eventos_total: number;
  simulacoes_salvas: number;
  por_evento: LinhaEvento[];
  por_modo: LinhaModo[];
  serie: LinhaSerie[];
}

function numero(v: number) {
  return v.toLocaleString("pt-BR");
}

function diaBr(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function Indicador({
  rotulo,
  valor,
  detalhe,
  icone: Icone,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  icone: typeof Users;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
          <p className="num-destaque mt-1 text-2xl font-semibold">{valor}</p>
          {detalhe ? <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p> : null}
        </div>
        <Icone className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </CardContent>
    </Card>
  );
}

function PainelMetricas() {
  const [dias, setDias] = useState(30);

  const consulta = useQuery({
    queryKey: ["metricas-precificacao", dias],
    queryFn: async (): Promise<Metricas> => {
      const { data, error } = await supabase.rpc("metricas_precificacao", { _dias: dias });
      if (error) throw error;
      return data as unknown as Metricas;
    },
  });

  const m = consulta.data;

  const conversao = useMemo(() => {
    if (!m) return null;
    const iniciadas = m.por_evento.find((e) => e.evento === "simulacao_iniciada")?.total ?? 0;
    const concluidas = m.por_evento.find((e) => e.evento === "simulacao_concluida")?.total ?? 0;
    if (!iniciadas) return null;
    return (concluidas / iniciadas) * 100;
  }, [m]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Métricas de uso</h1>
          <p className="text-sm text-muted-foreground">
            Sessões, usuários e eventos principais da precificação registrados pelo próprio sistema.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={String(dias)} onValueChange={(v) => setDias(Number(v))}>
            <TabsList>
              <TabsTrigger value="7">7 dias</TabsTrigger>
              <TabsTrigger value="30">30 dias</TabsTrigger>
              <TabsTrigger value="90">90 dias</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void consulta.refetch()}
            aria-label="Atualizar métricas"
          >
            <RefreshCw className={consulta.isFetching ? "size-4 animate-spin" : "size-4"} aria-hidden />
          </Button>
        </div>
      </header>

      {consulta.isError ? (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">
            Não foi possível carregar as métricas. Tente novamente em alguns instantes.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          rotulo="Sessões"
          valor={m ? numero(m.sessoes) : "—"}
          detalhe={`Últimos ${dias} dias`}
          icone={Activity}
        />
        <Indicador
          rotulo="Usuários"
          valor={m ? numero(m.usuarios) : "—"}
          detalhe="Contas distintas com atividade"
          icone={Users}
        />
        <Indicador
          rotulo="Eventos registrados"
          valor={m ? numero(m.eventos_total) : "—"}
          detalhe="Todas as interações monitoradas"
          icone={BarChart3}
        />
        <Indicador
          rotulo="Conversão de simulação"
          valor={conversao === null ? "—" : `${conversao.toFixed(1)}%`}
          detalhe="Concluídas ÷ iniciadas"
          icone={BarChart3}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução diária</CardTitle>
          <CardDescription>Sessões e usuários por dia no período selecionado.</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={m?.serie ?? []}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="dia" tickFormatter={diaBr} fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip labelFormatter={(v) => diaBr(String(v))} />
              <Legend />
              <Line
                type="monotone"
                dataKey="sessoes"
                name="Sessões"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="usuarios"
                name="Usuários"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eventos principais por dia</CardTitle>
          <CardDescription>
            Início de simulação, simulação concluída e exportações do relatório.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={m?.serie ?? []}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="dia" tickFormatter={diaBr} fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip labelFormatter={(v) => diaBr(String(v))} />
              <Legend />
              <Bar dataKey="iniciadas" name="Iniciadas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="concluidas" name="Concluídas" fill="hsl(var(--chart-2, var(--primary)))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="exportacoes" name="Exportações" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Eventos no período</CardTitle>
            <CardDescription>Volume, sessões e usuários por tipo de evento.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Sessões</TableHead>
                  <TableHead className="text-right">Usuários</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(m?.por_evento ?? []).map((e) => (
                  <TableRow key={e.evento}>
                    <TableCell className="flex items-center gap-2">
                      {ROTULOS[e.evento] ?? e.evento}
                      {PRINCIPAIS.includes(e.evento) ? (
                        <Badge variant="secondary" className="text-[10px]">
                          principal
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="num-destaque text-right">{numero(e.total)}</TableCell>
                    <TableCell className="num-destaque text-right">{numero(e.sessoes)}</TableCell>
                    <TableCell className="num-destaque text-right">{numero(e.usuarios)}</TableCell>
                  </TableRow>
                ))}
                {!consulta.isLoading && (m?.por_evento.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      Ainda não há eventos registrados neste período.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Uso por modo</CardTitle>
            <CardDescription>
              Distribuição entre Modo Rápido, simplificado e completo. Simulações salvas no período:{" "}
              <strong>{m ? numero(m.simulacoes_salvas) : "—"}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modo</TableHead>
                  <TableHead className="text-right">Eventos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(m?.por_modo ?? []).map((linha) => (
                  <TableRow key={linha.modo}>
                    <TableCell className="capitalize">{linha.modo.replace("_", " ")}</TableCell>
                    <TableCell className="num-destaque text-right">{numero(linha.total)}</TableCell>
                  </TableRow>
                ))}
                {!consulta.isLoading && (m?.por_modo.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="py-6 text-center text-sm text-muted-foreground">
                      Sem dados no período.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Os eventos são gravados de forma anônima (sessão, evento e parâmetros técnicos) e servem
        apenas para acompanhamento interno de desempenho, em paralelo ao Google Analytics.
      </p>
    </div>
  );
}
