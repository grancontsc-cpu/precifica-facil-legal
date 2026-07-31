import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, ShieldCheck } from "lucide-react";

import { Glossario } from "@/components/app/Glossario";
import { MenuConta } from "@/components/app/MenuConta";
import { NavegacaoMobile } from "@/components/app/NavegacaoMobile";
import {
  NAV_ADMIN,
  NAV_DIARIO,
  NAV_GESTAO,
  itemAtivo,
  type ItemNav,
} from "@/components/app/navegacao";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/hooks/useApp";
import { cn } from "@/lib/utils";

function LinkTopo({ item, ativo }: { item: ItemNav; ativo: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      title={item.descricao}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        ativo
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {item.label}
    </Link>
  );
}

function MenuSuspenso({
  rotulo,
  itens,
  pathname,
}: {
  rotulo: string;
  itens: ItemNav[];
  pathname: string;
}) {
  const algumAtivo = itens.some((i) => itemAtivo(pathname, i.to));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
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
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {rotulo}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {itens.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem key={item.to} asChild>
              <Link to={item.to} className="items-start gap-3">
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const { organizations, orgId, setOrgId, isSuperAdmin, memberships, situacaoLicenca } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ehGestor = memberships.some((m) => m.role === "manager");
  const empresaAtual = organizations.find((o) => o.id === orgId);

  return (
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <Link
            to="/simulador"
            className="shrink-0 text-base font-semibold tracking-tight text-foreground"
          >
            Precifica <span className="text-primary">Grancont</span>
          </Link>

          <nav aria-label="Navegação principal" className="ml-4 hidden items-center gap-1 lg:flex">
            {NAV_DIARIO.map((item) => (
              <LinkTopo key={item.to} item={item} ativo={itemAtivo(pathname, item.to)} />
            ))}
            {ehGestor && !isSuperAdmin ? (
              <MenuSuspenso rotulo="Minha empresa" itens={NAV_GESTAO} pathname={pathname} />
            ) : null}
            {isSuperAdmin ? (
              <MenuSuspenso rotulo="Administração" itens={NAV_ADMIN} pathname={pathname} />
            ) : null}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden lg:block">
              <Glossario />
            </div>
            {organizations.length > 1 ? (
              <Select value={orgId ?? undefined} onValueChange={setOrgId}>
                <SelectTrigger
                  className="h-10 w-[150px] sm:w-[210px]"
                  aria-label="Empresa selecionada"
                >
                  <SelectValue placeholder="Escolher empresa" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : empresaAtual ? (
              <Badge variant="outline" className="hidden max-w-[220px] truncate sm:inline-flex">
                {empresaAtual.name}
              </Badge>
            ) : null}
            <MenuConta />
          </div>
        </div>

        {situacaoLicenca.emTeste && situacaoLicenca.liberado && (
          <div className="border-t border-border bg-primary/10 px-4 py-2 text-center text-xs text-foreground sm:px-6">
            Teste gratuito: <strong>{situacaoLicenca.diasRestantes} dia(s)</strong> restantes.
            Depois desse prazo, o acesso depende da liberação do Administrador Grancont.
          </div>
        )}
      </header>

      {children}

      <NavegacaoMobile ehGestor={ehGestor} isSuperAdmin={isSuperAdmin} />
    </div>
  );
}
