import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Botão flutuante que retorna ao topo do simulador, com foco acessível. */
export function VoltarAoTopo({ alvoId = "conteudo-principal" }: { alvoId?: string }) {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const aoRolar = () => setVisivel(window.scrollY > 400);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  const voltar = () => {
    const prefereReduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: prefereReduzir ? "auto" : "smooth" });
    const alvo = document.getElementById(alvoId);
    if (alvo instanceof HTMLElement) alvo.focus({ preventScroll: true });
  };

  if (!visivel) return null;

  return (
    <Button
      type="button"
      size="icon"
      variant="secondary"
      onClick={voltar}
      title="Voltar ao topo"
      aria-label="Voltar ao topo da página"
      className="fixed bottom-36 right-4 z-40 h-11 w-11 rounded-full border border-border shadow-lg lg:bottom-6 lg:right-6"
    >
      <ArrowUp className="h-5 w-5" aria-hidden />
    </Button>
  );
}
