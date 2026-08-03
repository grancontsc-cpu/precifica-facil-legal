import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { LogoGrancont } from "@/components/app/LogoGrancont";
import { useApp } from "@/hooks/useApp";
import { rotaBloqueio } from "@/lib/licencas";

export function Carregando({
  texto = "Carregando…",
  marca = false,
}: {
  texto?: string;
  /** Exibe a logomarca — usar em telas fora do AppShell (que já tem a marca no topo). */
  marca?: boolean;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      {marca ? <LogoGrancont className="h-9 w-auto" /> : null}
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {texto}
      </p>
    </div>
  );
}


/** Bloqueia a renderização até resolver sessão, situação da conta e papel. */
export function GuardaStatus({ children }: { children: ReactNode }) {
  const { loading, accountStatus, situacaoLicenca, isSuperAdmin } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !accountStatus) return;
    if (accountStatus === "active") {
      if (!isSuperAdmin && !situacaoLicenca.liberado)
        navigate({ to: rotaBloqueio(situacaoLicenca), replace: true });
      return;
    }
    const destino =
      accountStatus === "suspended"
        ? "/licenca-suspensa"
        : accountStatus === "pending_approval"
          ? "/aguardando-aprovacao"
          : accountStatus === "pending_email_verification" || accountStatus === "invited"
            ? "/confirmar-email"
            : "/acesso-negado";
    navigate({ to: destino, replace: true });
  }, [loading, accountStatus, navigate, isSuperAdmin, situacaoLicenca]);

  if (loading || !accountStatus || accountStatus !== "active") return <Carregando />;
  if (!isSuperAdmin && !situacaoLicenca.liberado) return <Carregando texto="Verificando sua licença…" />;
  return <>{children}</>;
}

/** Restringe uma rota a um papel mínimo. */
export function ExigePapel({ papel, children }: { papel: "manager" | "super_admin"; children: ReactNode }) {
  const { loading, isSuperAdmin, memberships } = useApp();
  const navigate = useNavigate();
  const permitido = isSuperAdmin || (papel === "manager" && memberships.some((m) => m.role === "manager"));

  useEffect(() => {
    if (loading) return;
    if (!permitido) navigate({ to: "/acesso-negado", replace: true });
  }, [loading, permitido, navigate]);

  if (loading || !permitido) return <Carregando />;
  return <>{children}</>;
}
