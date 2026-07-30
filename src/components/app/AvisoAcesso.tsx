import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MENSAGENS_ACESSO, type CodigoAcesso } from "@/lib/acesso-simulacao";

interface AvisoAcessoProps {
  codigo: CodigoAcesso;
  /** Ações opcionais exibidas abaixo da mensagem. */
  acoes?: { rotulo: string; onClick: () => void; variante?: "default" | "outline" }[];
}

/**
 * Aviso padrão de acesso negado. Mostra apenas mensagens genéricas do catálogo
 * (src/lib/acesso-simulacao.ts) — nunca dados do registro solicitado.
 */
export function AvisoAcesso({ codigo, acoes = [] }: AvisoAcessoProps) {
  const msg = MENSAGENS_ACESSO[codigo];
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
      <div
        role="alert"
        className="rounded-xl border border-border bg-card p-5 text-center sm:p-8"
      >
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted">
          <ShieldAlert className="h-5 w-5 text-muted-foreground" aria-hidden />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-foreground">{msg.titulo}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{msg.descricao}</p>
        <p className="mt-1 text-sm text-muted-foreground">{msg.orientacao}</p>
        {acoes.length > 0 && (
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
            {acoes.map((a) => (
              <Button
                key={a.rotulo}
                variant={a.variante ?? "default"}
                className="w-full sm:w-auto"
                onClick={a.onClick}
              >
                {a.rotulo}
              </Button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
