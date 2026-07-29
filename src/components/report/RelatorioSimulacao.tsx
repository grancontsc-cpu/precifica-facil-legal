import { LogoGrancont } from "@/components/app/LogoGrancont";
import { formatData } from "@/lib/format";
import type { BlocoRelatorio, Relatorio } from "@/lib/report";

function Bloco({ bloco }: { bloco: BlocoRelatorio }) {
  return (
    <section className="rel-bloco mt-5">
      <h3 className="border-b border-border pb-1 text-sm font-semibold uppercase tracking-wide text-primary">
        {bloco.titulo}
      </h3>
      {bloco.descricao ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{bloco.descricao}</p>
      ) : null}
      <table className="mt-2 w-full border-collapse text-[12px]">
        <tbody>
          {bloco.linhas.map((l, i) => (
            <tr key={`${l.rotulo}-${i}`} className="border-b border-border/60 align-top">
              <th className="w-[45%] py-1 pr-3 text-left font-medium text-foreground">
                {l.rotulo}
                {l.detalhe ? (
                  <span className="block text-[10.5px] font-normal text-muted-foreground">
                    {l.detalhe}
                  </span>
                ) : null}
              </th>
              <td
                className={`py-1 text-right tabular-nums ${
                  l.destaque ? "font-semibold text-foreground" : "text-foreground"
                }`}
              >
                {l.valor}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function RelatorioSimulacao({ rel }: { rel: Relatorio }) {
  return (
    <article id="relatorio-impressao" className="rel-print bg-card p-6 text-foreground">
      <header className="flex items-start justify-between gap-6 border-b-2 border-primary pb-3">
        <div className="text-primary">
          <LogoGrancont className="h-12 w-auto" />
        </div>
        <div className="text-right text-[11px] text-muted-foreground">
          <p className="text-sm font-semibold text-foreground">Relatório de precificação</p>
          <p>{rel.meta.empresa}</p>
          <p>Emitido em {formatData(new Date())}</p>
        </div>
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[12px] sm:grid-cols-4">
        <div>
          <dt className="text-[10.5px] uppercase text-muted-foreground">Empresa cliente</dt>
          <dd className="font-medium">{rel.meta.empresa}</dd>
        </div>
        <div>
          <dt className="text-[10.5px] uppercase text-muted-foreground">Produto</dt>
          <dd className="font-medium">{rel.resumo.produto}</dd>
        </div>
        <div>
          <dt className="text-[10.5px] uppercase text-muted-foreground">Data da simulação</dt>
          <dd className="font-medium">{formatData(rel.meta.dataSimulacao)}</dd>
        </div>
        <div>
          <dt className="text-[10.5px] uppercase text-muted-foreground">Perfil tributário</dt>
          <dd className="font-medium">{rel.meta.perfilTributario}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[10.5px] uppercase text-muted-foreground">Simulação</dt>
          <dd className="font-medium">{rel.meta.tituloSimulacao}</dd>
        </div>
        {rel.meta.emitidoPor ? (
          <div className="col-span-2">
            <dt className="text-[10.5px] uppercase text-muted-foreground">Emitido por</dt>
            <dd className="font-medium">{rel.meta.emitidoPor}</dd>
          </div>
        ) : null}
      </dl>

      {rel.blocos.map((b) => (
        <Bloco key={b.titulo} bloco={b} />
      ))}

      {rel.comparacao ? <Bloco bloco={rel.comparacao} /> : null}

      <section className="rel-bloco mt-5">
        <h3 className="border-b border-border pb-1 text-sm font-semibold uppercase tracking-wide text-primary">
          Premissas
        </h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px]">
          {rel.premissas.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </section>

      <section className="rel-bloco mt-5">
        <h3 className="border-b border-border pb-1 text-sm font-semibold uppercase tracking-wide text-primary">
          Observações
        </h3>
        <p className="mt-2 whitespace-pre-wrap text-[12px]">
          {rel.observacoes || "Sem observações adicionais."}
        </p>
      </section>

      <footer className="mt-6 rounded-md border border-warning/40 bg-warning/10 p-3 text-[11px] leading-relaxed">
        {rel.aviso}
      </footer>
    </article>
  );
}
