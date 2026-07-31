import { Loader2, MailCheck, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

/**
 * Espera progressiva entre reenvios: 5s para o primeiro, 30s para o segundo,
 * 60s para o terceiro e 5 minutos daí em diante (evita bloqueio por excesso
 * de envios no servidor de autenticação).
 */
export const ESPERAS_REENVIO = [5, 30, 60, 300] as const;

export function esperaReenvio(reenviosFeitos: number): number {
  return ESPERAS_REENVIO[Math.min(reenviosFeitos, ESPERAS_REENVIO.length - 1)];
}

export function rotuloEspera(segundos: number): string {
  if (segundos < 60) return `${segundos}s`;
  const min = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return resto === 0 ? `${min}min` : `${min}min ${resto}s`;
}

type Props = {
  email: string;
  /** Início imediato da contagem (tela de "confirme seu e-mail" logo após o cadastro). */
  iniciarBloqueado?: boolean;
  className?: string;
};

export function ReenviarConfirmacao({ email, iniciarBloqueado = true, className }: Props) {
  const [reenvios, setReenvios] = useState(0);
  const [restante, setRestante] = useState(iniciarBloqueado ? ESPERAS_REENVIO[0] : 0);
  const [enviando, setEnviando] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (restante <= 0) return;
    timer.current = setInterval(() => setRestante((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [restante > 0]);

  const reenviar = useCallback(async () => {
    if (restante > 0 || enviando) return;
    setEnviando(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/entrando` },
    });
    setEnviando(false);

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("rate") || msg.includes("security purposes")) {
        setRestante(60);
        toast.error("Muitas tentativas seguidas. Aguarde um minuto antes de pedir um novo link.");
        return;
      }
      if (msg.includes("already") || msg.includes("confirmed")) {
        toast.success("Este e-mail já está confirmado. Faça login normalmente.");
        return;
      }
      toast.error("Não foi possível reenviar agora. Tente novamente em instantes.");
      return;
    }

    const feitos = reenvios + 1;
    setReenvios(feitos);
    setRestante(esperaReenvio(feitos));
    toast.success(`Novo link enviado para ${email}. Confira também a caixa de spam.`);
  }, [restante, enviando, email, reenvios]);

  return (
    <div className={className}>
      <Button type="button" variant="outline" className="w-full" onClick={() => void reenviar()} disabled={restante > 0 || enviando}>
        {enviando ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : restante > 0 ? (
          <>
            <RefreshCw className="h-4 w-4" aria-hidden /> Reenviar em {rotuloEspera(restante)}
          </>
        ) : (
          <>
            <MailCheck className="h-4 w-4" aria-hidden /> Reenviar e-mail de confirmação
          </>
        )}
      </Button>
      <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
        {reenvios === 0
          ? "Não recebeu? O botão libera em poucos segundos."
          : `${reenvios} reenvio(s) feito(s). Próximo em ${rotuloEspera(esperaReenvio(reenvios))} após o último envio.`}
      </p>
    </div>
  );
}
