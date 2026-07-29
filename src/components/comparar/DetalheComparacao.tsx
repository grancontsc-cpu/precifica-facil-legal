import { Badge } from "@/components/ui/badge";
import type { SupplierComparison } from "@/types/comparison";

export function DetalheComparacao({ comparacao }: { comparacao: SupplierComparison }) {
  if (comparacao.explicacoes.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">
        Por que uma alternativa é melhor que a outra
      </h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {comparacao.explicacoes.map((e) => {
          const vencedor = e.id === comparacao.vencedorId;
          return (
            <article
              key={e.id}
              className={`rounded-xl border bg-card p-4 shadow-[var(--shadow-card)] ${
                vencedor ? "border-primary" : "border-border"
              }`}
            >
              <header className="mb-2 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">{e.titulo}</h3>
                {vencedor ? <Badge>Melhor opção</Badge> : null}
              </header>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {e.linhas.map((linha, i) => (
                  <li key={i} className="leading-relaxed">
                    • {linha}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
