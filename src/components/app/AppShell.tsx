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
import { LogoInicio } from "@/components/app/LogoInicio";
import { ProvedorAlteracoesPendentes } from "@/hooks/useAlteracoesPendentes";


function LinkTopo({ item, ativo }: { item: ItemNav; ativo: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      // Sem `title`: o texto visível já nomeia o link e o title seria lido
      // logo em seguida como descrição, duplicando a leitura.
      aria-current={ativo ? "page" : undefined}
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
          {algumAtivo ? <span className="sr-only">(seção atual)</span> : null}
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {/* O menu já recebe o nome do gatilho; o rótulo visível fica oculto
            para leitores de tela para não repetir o mesmo texto. */}
        <DropdownMenuLabel
          aria-hidden
          className="text-xs font-normal text-muted-foreground"
        >
          {rotulo}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {itens.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem key={item.to} asChild>
              <Link
                to={item.to}
                aria-current={itemAtivo(pathname, item.to) ? "page" : undefined}
                className="items-start gap-3"
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


export function AppShell({ children }: { children: React.ReactNode }) {
  const { organizations, orgId, setOrgId, isSuperAdmin, memberships, situacaoLicenca } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ehGestor = memberships.some((m) => m.role === "manager");
  const empresaAtual = organizations.find((o) => o.id === orgId);

  return (
    <ProvedorAlteracoesPendentes>
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      {/* Atalho de teclado: visível apenas ao receber foco (primeiro Tab). */}
      <a
        href="#conteudo-principal"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg focus-visible:not-sr-only focus-visible:absolute focus-visible:left-3 focus-visible:top-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus:not-sr-only focus:absolute focus:left-3 focus:top-3"
      >
        Pular para o simulador
      </a>
      <header
        role="banner"
        aria-label="Cabeçalho do Precifica Grancont"
        className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-6">

          <LogoInicio naRotaInicial={itemAtivo(pathname, "/simulador")} />

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

          <div
            role="group"
            aria-label="Ferramentas da conta e da empresa"
            className="ml-auto flex min-w-0 items-center gap-2"
          >

            <div className="hidden lg:block">
              <Glossario />
            </div>
            {organizations.length > 1 ? (
              <Select value={orgId ?? undefined} onValueChange={setOrgId}>
                <SelectTrigger
                  className="h-10 w-[120px] min-w-0 shrink sm:w-[210px]"
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
                <span className="sr-only">Empresa atual: </span>
                {empresaAtual.name}
              </Badge>
            ) : null}
            <MenuConta />
          </div>
        </div>

        {situacaoLicenca.emTeste && situacaoLicenca.liberado && (
          <div
            role="status"
            aria-live="polite"
            className="border-t border-border bg-primary/10 px-4 py-2 text-center text-xs text-foreground sm:px-6"
          >
            Teste gratuito: <strong>{situacaoLicenca.diasRestantes} dia(s)</strong> restantes.
            Depois desse prazo, o acesso depende da liberação do Administrador Grancont.
          </div>
        )}
      </header>

      <div id="conteudo-principal" tabIndex={-1} className="focus:outline-none">
        {children}
      </div>



      <NavegacaoMobile ehGestor={ehGestor} isSuperAdmin={isSuperAdmin} />
    </div>
    </ProvedorAlteracoesPendentes>
  );
}
