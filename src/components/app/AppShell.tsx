import { Link, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  Calculator,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  MailPlus,
  Package,
  Percent,
  Scale,
  Users,
  ShieldQuestion,
  KeyRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NOME_PAPEL, useApp } from "@/hooks/useApp";
import { cn } from "@/lib/utils";

type Acesso = "todos" | "manager" | "super_admin";

const LINKS: { to: string; label: string; icon: typeof Calculator; acesso: Acesso }[] = [
  { to: "/admin", label: "Administração", icon: LayoutDashboard, acesso: "super_admin" },
  { to: "/gestao", label: "Gestão", icon: LayoutDashboard, acesso: "manager" },
  { to: "/simulador", label: "Simulador", icon: Calculator, acesso: "todos" },
  { to: "/comparar", label: "Comparar fornecedores", icon: Scale, acesso: "todos" },
  { to: "/simulacoes", label: "Simulações", icon: ClipboardList, acesso: "todos" },
  { to: "/produtos", label: "Produtos", icon: Package, acesso: "todos" },
  { to: "/perfis", label: "Perfis tributários", icon: Percent, acesso: "todos" },
  { to: "/gestao/usuarios", label: "Usuários", icon: Users, acesso: "manager" },
  { to: "/gestao/convites", label: "Convites", icon: MailPlus, acesso: "manager" },
  { to: "/admin/usuarios", label: "Todos os usuários", icon: Users, acesso: "super_admin" },
  { to: "/admin/convites", label: "Todos os convites", icon: MailPlus, acesso: "super_admin" },
  { to: "/admin/solicitacoes", label: "Solicitações de acesso", icon: ShieldQuestion, acesso: "super_admin" },
  { to: "/admin/licencas", label: "Licenças", icon: KeyRound, acesso: "super_admin" },
  { to: "/empresas", label: "Empresas", icon: Building2, acesso: "super_admin" },
  { to: "/auditoria", label: "Auditoria", icon: History, acesso: "super_admin" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { organizations, orgId, setOrgId, isSuperAdmin, papel, email, signOut, memberships, situacaoLicenca } =
    useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ehGestor = memberships.some((m) => m.role === "manager");

  const visiveis = LINKS.filter((l) => {
    if (l.acesso === "todos") return true;
    if (l.acesso === "super_admin") return isSuperAdmin;
    return ehGestor && !isSuperAdmin;
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/simulador" className="text-base font-semibold tracking-tight text-foreground">
            Precifica <span className="text-primary">Grancont</span>
          </Link>
          <Badge variant="outline" className="border-primary/30 text-primary">
            {NOME_PAPEL[papel]}
          </Badge>

          <div className="ml-auto flex items-center gap-2">
            {organizations.length > 1 ? (
              <Select value={orgId ?? undefined} onValueChange={setOrgId}>
                <SelectTrigger className="h-9 w-[190px] sm:w-[210px]">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : organizations.length === 1 ? (
              <span className="hidden text-xs text-muted-foreground sm:inline">{organizations[0].name}</span>
            ) : null}
            <span className="hidden text-xs text-muted-foreground md:inline">{email}</span>
            <Button variant="ghost" size="sm" onClick={() => void signOut()} aria-label="Sair">
              <LogOut className="h-4 w-4" aria-hidden />
            </Button>
          </div>

          <nav className="order-last flex w-full gap-1 overflow-x-auto pb-1">
            {visiveis.map((l) => {
              const Icon = l.icon;
              const ativo = pathname === l.to || pathname.startsWith(`${l.to}/`);
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                    ativo
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
