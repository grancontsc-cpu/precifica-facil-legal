import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Info, RotateCcw, Zap } from "lucide-react";

import { metaPagina } from "@/lib/seo-head";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CampoNumero, CampoTexto } from "@/components/pricing/CampoNumero";
import { useAliquotas } from "@/hooks/useAliquotas";
import { sincronizarOperacao, UFS } from "@/lib/aliquotas";
import { REGIMES, simular } from "@/lib/pricing-engine";
import { PainelFronteira } from "@/components/pricing/PainelFronteira";
import { AliquotasTrajeto } from "@/components/pricing/AliquotasTrajeto";
import { aplicarRegime, estadoInicial, operacaoPadrao } from "@/lib/pricing-defaults";
import { SuposicoesFiscais } from "@/components/pricing/SuposicoesFiscais";
import { ajustesVazios, aplicarAjustes, type AjustesRapido } from "@/lib/suposicoes-rapido";
import { formatBRL } from "@/lib/format";
import { useApp } from "@/hooks/useApp";
import type { Regime, SimulationState } from "@/types/pricing";

const TITULO = "Modo rápido — Precifica Grancont";
const DESCRICAO =
  "Estimativa de preço de venda em três passos: produto, valor e trajeto da mercadoria entre estados.";

export const Route = createFileRoute("/_authenticated/rapido")({
  head: () => ({
    ...metaPagina({ titulo: TITULO, descricao: DESCRICAO, caminho: "/rapido" }),
  }),
  component: ModoRapido,
});

const REGIMES_VALIDOS = new Set(REGIMES.map((r) => r.id as string));

function regimeDaEmpresa(valor: string | null | undefined): Regime {
  return valor && REGIMES_VALIDOS.has(valor) ? (valor as Regime) : "real";
}

/** Trilha visual dos passos — reforça progresso e reduz abandono. */
function Trilha({ passo }: { passo: number }) {
  const passos = ["Produto", "Valor", "Trajeto", "Preço"];
  return (
    <ol className="flex items-center gap-2" aria-label="Progresso do modo rápido">
      {passos.map((rotulo, i) => {
        const atual = i + 1 === passo;
        const concluido = i + 1 < passo;
        return (
          <li key={rotulo} className="flex flex-1 flex-col gap-1.5">
            <span
              aria-hidden
              className={
                "h-1.5 rounded-full transition-colors " +
                (atual || concluido ? "bg-primary" : "bg-border")
              }
            />
            <span
              className={
                "text-[11px] font-medium " +
                (atual ? "text-foreground" : "text-muted-foreground")
              }
              aria-current={atual ? "step" : undefined}
            >
              {rotulo}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ModoRapido() {
  const navigate = useNavigate();
  const { empresa } = useApp();
  const { tabela } = useAliquotas();

  const [passo, setPasso] = useState(1);
  const [nome, setNome] = useState("");
  const [valorUnitario, setValorUnitario] = useState(0);
  const [quantidade, setQuantidade] = useState(1);
  const [margem, setMargem] = useState(30);
  const [ufOrigem, setUfOrigem] = useState("");
  const [ufDestino, setUfDestino] = useState(empresa?.uf ?? "");
  const regime = regimeDaEmpresa(empresa?.regime);

  const estado = useMemo<SimulationState>(() => {
    const base = aplicarRegime(estadoInicial(), regime);
    const operacao = sincronizarOperacao(
      operacaoPadrao({ regime, ufOrigem, ufDestino: ufDestino || ufOrigem }),
      tabela,
    );
    return {
      ...base,
      produto: {
        ...base.produto,
        nome: nome.trim(),
        quantidade: quantidade || 1,
        valorUnitario,
      },
      venda: { ...base.venda, margemDesejada: margem },
      operacao,
    };
  }, [regime, ufOrigem, ufDestino, tabela, nome, quantidade, valorUnitario, margem]);

  const resultado = useMemo(() => simular(estado), [estado]);
  const recomendado = resultado.recomendado;

  const podeAvancar =
    (passo === 1 && nome.trim().length > 0) ||
    (passo === 2 && valorUnitario > 0 && quantidade > 0) ||
    (passo === 3 && !!ufOrigem && !!ufDestino);

  const reiniciar = () => {
    setPasso(1);
    setNome("");
    setValorUnitario(0);
    setQuantidade(1);
    setMargem(30);
    setUfOrigem("");
    setUfDestino(empresa?.uf ?? "");
  };

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 px-4 py-8 sm:py-12">
      <header className="space-y-2 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Zap className="size-3.5" aria-hidden />
          Modo rápido
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Preço de venda em três passos
        </h1>
        <p className="text-sm text-muted-foreground">
          Uma estimativa imediata usando as alíquotas gerais do trajeto informado.
        </p>
      </header>

      <Trilha passo={passo} />

      <div className="rounded-xl border border-border bg-surface p-5 sm:p-6">
        {passo === 1 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Qual produto você quer precificar?
              </h2>
              <p className="text-sm text-muted-foreground">
                Só o nome, para você reconhecer o cálculo depois.
              </p>
            </div>
            <CampoTexto
              label="Nome do produto"
              value={nome}
              onChange={setNome}
              placeholder="Ex.: Café torrado e moído 500g"
            />
          </div>
        ) : null}

        {passo === 2 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Quanto você pagou?</h2>
              <p className="text-sm text-muted-foreground">
                Valor por unidade na nota do fornecedor e a quantidade comprada.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoNumero
                label="Valor unitário de compra"
                prefixo="R$"
                value={valorUnitario}
                onChange={setValorUnitario}
              />
              <CampoNumero label="Quantidade" value={quantidade} onChange={setQuantidade} />
              <CampoNumero
                label="Margem desejada"
                sufixo="%"
                value={margem}
                onChange={setMargem}
                className="sm:col-span-2"
              />
            </div>
          </div>
        ) : null}

        {passo === 3 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                De onde vem e para onde vai?
              </h2>
              <p className="text-sm text-muted-foreground">
                O trajeto define a alíquota interestadual e o ICMS de fronteira.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rapido-origem">Estado de origem</Label>
                <Select value={ufOrigem || undefined} onValueChange={setUfOrigem}>
                  <SelectTrigger id="rapido-origem">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {UFS.map((u) => (
                      <SelectItem key={u.sigla} value={u.sigla}>
                        {u.sigla} — {u.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rapido-destino">Estado de destino</Label>
                <Select value={ufDestino || undefined} onValueChange={setUfDestino}>
                  <SelectTrigger id="rapido-destino">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {UFS.map((u) => (
                      <SelectItem key={u.sigla} value={u.sigla}>
                        {u.sigla} — {u.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <AliquotasTrajeto ufOrigem={ufOrigem} ufDestino={ufDestino} />

            <p className="text-xs text-muted-foreground">
              Regime considerado: {REGIMES.find((r) => r.id === regime)?.nome ?? regime}
              {empresa?.regime ? " (cadastro da empresa)" : " (padrão)"}.
            </p>
          </div>
        ) : null}

        {passo === 4 ? (
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Preço de venda sugerido por unidade</p>
              <p className="num-destaque mt-1 text-4xl font-bold text-foreground">
                {recomendado ? formatBRL(recomendado.precoFinal) : "—"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {nome || "Produto"} · margem de {margem}%
              </p>
            </div>

            {recomendado ? (
              <dl className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-background p-3">
                  <dt className="text-xs text-muted-foreground">Custo líquido unitário</dt>
                  <dd className="num-destaque text-base font-semibold">
                    {formatBRL(recomendado.custoLiquidoUnitario)}
                  </dd>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <dt className="text-xs text-muted-foreground">Créditos recuperáveis</dt>
                  <dd className="num-destaque text-base font-semibold">
                    {formatBRL(resultado.compra.creditosTotais ?? 0)}
                  </dd>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <dt className="text-xs text-muted-foreground">Resultado por unidade</dt>
                  <dd className="num-destaque text-base font-semibold">
                    {formatBRL(recomendado.resultadoUnidade)}
                  </dd>
                </div>
              </dl>
            ) : (
              <Alert variant="destructive">
                <AlertDescription>
                  {resultado.mensagemImpossivel ??
                    "Não foi possível calcular um preço com esses dados. Revise os valores informados."}
                </AlertDescription>
              </Alert>
            )}

            <PainelFronteira state={estado} resultado={resultado} compacto />

            <Alert>
              <Info className="size-4" aria-hidden />
              <AlertDescription>
                Este é um <strong>valor aproximado</strong>. O modo rápido usa apenas as alíquotas
                gerais do trajeto e não considera frete, despesas de venda, benefícios fiscais nem
                créditos específicos. Para precificar com precisão, use o modo Simples ou Completo
                do simulador.
              </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" onClick={() => navigate({ to: "/simulador" })}>
                Refinar no simulador completo
              </Button>
              <Button variant="outline" className="flex-1" onClick={reiniciar}>
                <RotateCcw className="size-4" aria-hidden />
                Nova estimativa
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {passo < 4 ? (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() => setPasso((p) => Math.max(1, p - 1))}
            disabled={passo === 1}
          >
            <ArrowLeft className="size-4" aria-hidden />
            Voltar
          </Button>
          <Button onClick={() => setPasso((p) => p + 1)} disabled={!podeAvancar}>
            {passo === 3 ? "Ver preço sugerido" : "Continuar"}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">
        Precisa de todos os tributos abertos?{" "}
        <Link to="/simulador" className="font-medium text-primary underline-offset-4 hover:underline">
          Abrir o simulador completo
        </Link>
      </p>
    </div>
  );
}
