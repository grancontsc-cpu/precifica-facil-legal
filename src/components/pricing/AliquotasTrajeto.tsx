import { CalendarClock, CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatPercent } from "@/lib/format";
import { useAliquotas } from "@/hooks/useAliquotas";
import {
  detalheInterestadual,
  detalheInterna,
  nomeUf,
  statusBase,
  type DetalheAliquota,
} from "@/lib/aliquotas";
import { cn } from "@/lib/utils";

function dataBR(valor: string | null | undefined): string {
  if (!valor) return "—";
  const d = new Date(valor.length === 10 ? `${valor}T00:00:00` : valor);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

function Vigencia({ detalhe }: { detalhe: DetalheAliquota | null }) {
  if (!detalhe) return null;
  return (
    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
      Vigente desde {dataBR(detalhe.vigenciaInicio)}
      {detalhe.vigenciaFim ? ` até ${dataBR(detalhe.vigenciaFim)}` : ""}
      {detalhe.fonte ? ` · ${detalhe.fonte}` : ""}
    </p>
  );
}

/**
 * Mostra as alíquotas que o motor está usando para o trajeto escolhido
 * (interna do destino e interestadual do par) junto do status da base:
 * vigência carregada e data da última atualização.
 */
export function AliquotasTrajeto({
  ufOrigem,
  ufDestino,
  importada = false,
  className,
}: {
  ufOrigem: string;
  ufDestino: string;
  importada?: boolean;
  className?: string;
}) {
  const { tabela, carregando, erro } = useAliquotas();
  const origem = (ufOrigem ?? "").toUpperCase();
  const destino = (ufDestino ?? "").toUpperCase();

  if (!origem || !destino) return null;

  const status = statusBase(tabela);
  const interna = detalheInterna(tabela, destino);
  const inter = origem === destino ? null : detalheInterestadual(tabela, origem, destino);
  const valorInter = inter
    ? importada
      ? (inter.aliquotaImportado ?? inter.aliquota)
      : inter.aliquota
    : null;
  const diferenca =
    interna && valorInter !== null ? Math.max(0, interna.aliquota - valorInter) : null;

  return (
    <section
      aria-label="Alíquotas usadas no cálculo"
      className={cn("rounded-lg border border-border bg-surface p-3", className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">
          Alíquotas em uso · {origem} ({nomeUf(origem)}) → {destino} ({nomeUf(destino)})
        </h4>
        {carregando ? (
          <Badge variant="outline" className="gap-1">
            <Loader2 className="size-3 animate-spin" aria-hidden />
            Carregando base
          </Badge>
        ) : (
          <Badge
            variant={status.situacao === "vigente" ? "secondary" : "destructive"}
            className="gap-1"
          >
            {status.situacao === "vigente" ? (
              <CircleCheck className="size-3" aria-hidden />
            ) : (
              <CircleAlert className="size-3" aria-hidden />
            )}
            {status.situacao === "vigente" ? "Base atualizada" : "Revisar base"}
          </Badge>
        )}
      </header>

      {erro ? (
        <p className="mt-2 text-xs text-destructive">
          Não foi possível carregar a tabela de alíquotas. Os valores exibidos podem estar
          incompletos.
        </p>
      ) : null}

      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-background p-2.5">
          <dt className="text-xs text-muted-foreground">Interna do destino ({destino})</dt>
          <dd className="num-destaque text-sm font-semibold text-foreground">
            {interna ? formatPercent(interna.aliquota) : "Não cadastrada"}
          </dd>
          <Vigencia detalhe={interna} />
        </div>
        <div className="rounded-md border border-border bg-background p-2.5">
          <dt className="text-xs text-muted-foreground">
            Interestadual {origem} → {destino}
            {importada ? " (importada)" : ""}
          </dt>
          <dd className="num-destaque text-sm font-semibold text-foreground">
            {origem === destino
              ? "Operação interna"
              : valorInter !== null
                ? formatPercent(valorInter)
                : "Não cadastrada"}
          </dd>
          <Vigencia detalhe={inter} />
        </div>
        <div className="rounded-md border border-border bg-background p-2.5">
          <dt className="text-xs text-muted-foreground">Diferencial (fronteira)</dt>
          <dd className="num-destaque text-sm font-semibold text-foreground">
            {origem === destino
              ? "Não aplicável"
              : diferenca !== null
                ? formatPercent(diferenca)
                : "—"}
          </dd>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Interna do destino menos a interestadual.
          </p>
        </div>
      </dl>

      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
        <CalendarClock className="mt-0.5 size-3 shrink-0" aria-hidden />
        <span>
          Base vigente a partir de {dataBR(status.vigencia)} · última atualização em{" "}
          {dataBR(status.atualizadaEm)}
          {status.diasDesdeAtualizacao !== null
            ? ` (há ${status.diasDesdeAtualizacao} dia${status.diasDesdeAtualizacao === 1 ? "" : "s"})`
            : ""}
          . {status.mensagem}
        </span>
      </p>
    </section>
  );
}
