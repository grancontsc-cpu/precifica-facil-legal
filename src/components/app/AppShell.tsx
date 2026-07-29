import { Link, useRouterState } from "@tanstack/react-router";
import { Building2, Calculator, ClipboardList, History, LogOut, Package, Percent } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/hooks/useApp";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/simulador", label: "Simulador", icon: Calculator, adminOnly: false },
  { to: "/simulacoes", label: "Simulações", icon: ClipboardList, adminOnly: false },
  { to: "/produtos", label: "Produtos", icon: Package, adminOnly: false },
  { to: "/perfis", label: "Perfis tributários", icon: Percent, adminOnly: false },
  { to: "/empresas", label: "Empresas", icon: Building2, adminOnly: true },
  { to: "/auditoria", label: "Auditoria", icon: History, adminOnly: true },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { organizations, orgId, setOrgId, isGrancontAdmin, email, signOut, canEdit } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/simulador" className="text-base font-semibold tracking-tight text-foreground">
            Precifica <span className="text-primary">Grancont</span>
          </Link>
          <Badge variant="outline" className="border-primary/30 text-primary">
            {isGrancontAdmin ? "Admin Grancont" : canEdit ? "Admin da empresa" : "Visualizador"}
          </Badge>

          <div className="ml-auto flex items-center gap-2">
            {organizations.length > 0 ? (
              <Select value={orgId ?? undefined} onValueChange={setOrgId}>
                <SelectTrigger className="h-9 w-[210px]">
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
            ) : null}
            <span className="hidden text-xs text-muted-foreground md:inline">{email}</span>
            <Button variant="ghost" size="sm" onClick={() => void signOut()} aria-label="Sair">
              <LogOut className="h-4 w-4" aria-hidden />
            </Button>
          </div>

          <nav className="order-last flex w-full gap-1 overflow-x-auto pb-1">
            {LINKS.filter((l) => !l.adminOnly || isGrancontAdmin).map((l) => {
              const Icon = l.icon;
              const ativo = pathname.startsWith(l.to);
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
