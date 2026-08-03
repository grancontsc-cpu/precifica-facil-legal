import { Link } from "@tanstack/react-router";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { useRef } from "react";

import { itemAtivo, type ItemNav } from "@/components/app/navegacao";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Menu suspenso do cabeçalho.
 *
 * Teclado: o gatilho abre com Enter, Espaço ou seta para baixo; as setas
 * percorrem os itens em ciclo (`loop`); Enter seleciona; Esc fecha e devolve o
 * foco ao gatilho. Fechando com clique fora o foco também volta ao gatilho
 * (o Radix, por padrão, deixaria o foco no ponto clicado), mantendo
 * `aria-expanded="false"` no elemento que recebe o foco. Quando o usuário
 * escolhe um item e a navegação acontece, o foco não é puxado de volta ao
 * gatilho para não competir com a nova página.
 */
export function MenuSuspenso({
  rotulo,
  itens,
  pathname,
}: {
  rotulo: string;
  itens: ItemNav[];
  pathname: string;
}) {
  const algumAtivo = itens.some((i) => itemAtivo(pathname, i.to));
  const navegando = useRef(false);
  const gatilhoRef = useRef<HTMLButtonElement>(null);

  return (
    <DropdownMenu onOpenChange={(aberto) => (aberto ? (navegando.current = false) : undefined)}>
      <DropdownMenuTrigger asChild>
        <Button
          ref={gatilhoRef}
          variant="ghost"
          size="sm"
          className={cn(
            "h-9 gap-2 px-3 text-sm font-medium",
            algumAtivo
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "text-muted-foreground",
          )}
        >
          <ShieldCheck className="h-4 w-4" aria-hidden />
          {rotulo}
          {algumAtivo ? <span className="sr-only">(seção atual)</span> : null}
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-72"
        loop
        onCloseAutoFocus={(evento) => {
          // Após escolher um item a página muda: deixamos o foco com a nova
          // rota.
          if (navegando.current) {
            evento.preventDefault();
            return;
          }
          // Esc, clique fora ou perda de foco: assumimos o controle e
          // devolvemos o foco ao gatilho sempre (o Radix não faz isso quando
          // o fechamento veio de uma interação com ponteiro fora do menu).
          evento.preventDefault();
          gatilhoRef.current?.focus();
        }}
      >
        {/* O menu já recebe o nome do gatilho; o rótulo visível fica oculto
            para leitores de tela para não repetir o mesmo texto. */}
        <DropdownMenuLabel aria-hidden className="text-xs font-normal text-muted-foreground">
          {rotulo}
        </DropdownMenuLabel>
        <span className="sr-only">
          Use as setas para cima e para baixo para navegar, Enter para abrir e Esc para fechar.
        </span>
        <DropdownMenuSeparator />
        {itens.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem key={item.to} asChild textValue={item.label}>
              <Link
                to={item.to}
                aria-current={itemAtivo(pathname, item.to) ? "page" : undefined}
                className="items-start gap-3"
                onClick={() => {
                  navegando.current = true;
                }}
              >
                <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{item.label}</span>
                  <span className="block text-xs leading-snug text-muted-foreground">
                    {item.descricao}
                  </span>
                </span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
