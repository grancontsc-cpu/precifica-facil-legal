import { useEffect, useState } from "react";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  carregarAnalytics,
  gravarConsentimento,
  lerConsentimento,
  removerCookiesAnalytics,
  type DecisaoConsentimento,
} from "@/lib/consentimento";

/**
 * Banner de consentimento (LGPD). Enquanto não houver decisão, nenhum script
 * de analytics é carregado.
 */
export function ConsentimentoCookies() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const registro = lerConsentimento();
    if (!registro) {
      setVisivel(true);
      return;
    }
    if (registro.decisao === "aceito") carregarAnalytics();
  }, []);

  useEffect(() => {
    function abrir() {
      setVisivel(true);
    }
    window.addEventListener("precifica:abrir-consentimento", abrir);
    return () => window.removeEventListener("precifica:abrir-consentimento", abrir);
  }, []);

  function decidir(decisao: DecisaoConsentimento) {
    gravarConsentimento(decisao);
    if (decisao === "aceito") {
      carregarAnalytics();
    } else {
      removerCookiesAnalytics();
    }
    setVisivel(false);
  }

  if (!visivel) return null;

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-lg sm:flex-row sm:items-center sm:p-5">
        <div className="flex gap-3">
          <Cookie className="mt-0.5 hidden h-5 w-5 shrink-0 text-primary sm:block" aria-hidden />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Cookies e privacidade</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Usamos cookies de análise (Google Analytics) apenas para entender o uso da ferramenta e
              melhorá-la. Conforme a LGPD, eles só são ativados com o seu consentimento. Os cookies
              essenciais de login e preferências continuam funcionando.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2 sm:flex-col">
          <Button className="flex-1" onClick={() => decidir("aceito")}>
            Aceitar
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => decidir("recusado")}>
            Recusar
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Reabre o banner (para um link de "preferências de cookies"). */
export function abrirPreferenciasCookies() {
  window.dispatchEvent(new Event("precifica:abrir-consentimento"));
}
