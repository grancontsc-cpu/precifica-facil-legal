import { Link } from "@tanstack/react-router";
import { CalendarClock, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { LogoGrancont } from "@/components/app/LogoGrancont";
import { SolicitarAcessoAdmin } from "@/components/app/SolicitarAcessoAdmin";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { avaliarLicenca, type Licenca } from "@/lib/licencas";

interface Props {
  variante: "teste" | "licenca";
  titulo: string;
  descricao: string;
}

/** Aviso padrão para contas sem licença válida (teste expirado ou licença suspensa/cancelada). */
export function AvisoLicenca({ variante, titulo, descricao }: Props) {
  const [motivo, setMotivo] = useState<string | null>(null);
  const Icone = variante === "teste" ? CalendarClock : ShieldAlert;

  useEffect(() => {
    (async () => {
      const { data: sessao } = await supabase.auth.getUser();
      if (!sessao.user) return;
      const { data } = await supabase
        .from("licenses")
        .select("status, plan, trial_started_at, trial_ends_at, activated_at, expires_at, notes")
        .eq("user_id", sessao.user.id)
        .maybeSingle();
      setMotivo(avaliarLicenca((data as Licenca | null) ?? null).motivo);
    })();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
        <LogoGrancont className="mx-auto mb-6 h-8 w-auto" />
        <Icone
          className={`mx-auto h-8 w-8 ${variante === "teste" ? "text-primary" : "text-destructive"}`}
          aria-hidden
        />
        <h1 className="mt-3 text-lg font-semibold text-foreground">{titulo}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{motivo ?? descricao}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Para continuar utilizando o simulador, solicite a liberação da licença ao Administrador Grancont.
        </p>

        <div className="mt-6 space-y-2">
          <SolicitarAcessoAdmin className="w-full" />
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
          >
            Sair
          </Button>
        </div>

        <Link to="/login" search={{ next: undefined }} className="mt-3 inline-block text-xs text-primary hover:underline">
          Voltar para o login
        </Link>
      </div>
    </main>
  );
}
