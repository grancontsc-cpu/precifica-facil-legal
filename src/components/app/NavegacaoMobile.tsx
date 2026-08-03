import { Link, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useState } from "react";

import { Glossario } from "@/components/app/Glossario";
import {
  NAV_ADMIN,
  NAV_DIARIO,
  NAV_GESTAO,
  itemAtivo,
  type ItemNav,
} from "@/components/app/navegacao";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface Props {
  ehGestor: boolean;
  isSuperAdmin: boolean;
}

const PRINCIPAIS = NAV_DIARIO.slice(0, 3);

export function NavegacaoMobile({ ehGestor, isSuperAdmin }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [aberto, setAberto] = useState(false);

  const grupos: { titulo: string; itens: ItemNav[] }[] = [
    { titulo: "Usar o sistema", itens: NAV_DIARIO },
    ...(ehGestor && !isSuperAdmin ? [{ titulo: "Minha empresa", itens: NAV_GESTAO }] : []),
    ...(isSuperAdmin ? [{ titulo: "Administração Grancont", itens: NAV_ADMIN }] : []),
  ];

  return (
    <nav
      aria-label="Navegação rápida"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div className="grid grid-cols-4">
        {PRINCIPAIS.map((item) => {
          const Icon = item.icon;
          const ativo = itemAtivo(pathname, item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={ativo ? "page" : undefined}
              className={cn(
                "flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium",
                ativo ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {item.label}
            </Link>
          );
        })}

        <Sheet open={aberto} onOpenChange={setAberto}>
          <SheetTrigger
            className="flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium text-muted-foreground"
            aria-label="Abrir menu completo"
          >
            <Menu className="h-5 w-5" aria-hidden />
            Mais
          </SheetTrigger>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
              <SheetDescription>Escolha o que você quer fazer agora.</SheetDescription>
            </SheetHeader>
            <div className="space-y-6 px-4 pb-10">
              {grupos.map((g) => (
                <section key={g.titulo}>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.titulo}
                  </h2>
                  <ul className="space-y-1">
                    {g.itens.map((item) => {
                      const Icon = item.icon;
                      const ativo = itemAtivo(pathname, item.to);
                      return (
                        <li key={item.to}>
                          <Link
                            aria-current={ativo ? "page" : undefined}
                            to={item.to}
                            onClick={() => setAberto(false)}
                            className={cn(
                              "flex min-h-[56px] items-start gap-3 rounded-lg border border-transparent px-3 py-3 transition-colors",
                              ativo ? "border-primary/30 bg-accent" : "hover:bg-muted",
                            )}
                          >
                            <Icon
                              className={cn(
                                "mt-0.5 h-5 w-5 shrink-0",
                                ativo ? "text-primary" : "text-muted-foreground",
                              )}
                              aria-hidden
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-foreground">
                                {item.label}
                              </span>
                              <span className="block text-xs leading-snug text-muted-foreground">
                                {item.descricao}
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
              <div className="pt-2">
                <Glossario variant="outline" />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
