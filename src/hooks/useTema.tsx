import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Tema = "claro" | "escuro" | "sistema";

const CHAVE = "precifica:tema";

interface TemaContexto {
  tema: Tema;
  setTema: (t: Tema) => void;
  escuroAtivo: boolean;
}

const Ctx = createContext<TemaContexto | null>(null);

function preferenciaDoSistema(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function aplicar(escuro: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", escuro);
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTemaEstado] = useState<Tema>("claro");
  const [sistemaEscuro, setSistemaEscuro] = useState(false);

  // Leitura da preferência apenas após a hidratação.
  useEffect(() => {
    let guardado: Tema | null = null;
    try {
      const bruto = localStorage.getItem(CHAVE);
      if (bruto === "claro" || bruto === "escuro" || bruto === "sistema") guardado = bruto;
    } catch {
      /* preferência de interface apenas */
    }
    setSistemaEscuro(preferenciaDoSistema());
    if (guardado) setTemaEstado(guardado);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const aoMudar = () => setSistemaEscuro(mql.matches);
    mql.addEventListener("change", aoMudar);
    return () => mql.removeEventListener("change", aoMudar);
  }, []);

  const escuroAtivo = tema === "escuro" || (tema === "sistema" && sistemaEscuro);

  useEffect(() => {
    aplicar(escuroAtivo);
  }, [escuroAtivo]);

  const valor = useMemo<TemaContexto>(
    () => ({
      tema,
      escuroAtivo,
      setTema: (t) => {
        setTemaEstado(t);
        try {
          localStorage.setItem(CHAVE, t);
        } catch {
          /* preferência de interface apenas */
        }
      },
    }),
    [tema, escuroAtivo],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useTema() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTema precisa estar dentro de TemaProvider");
  return ctx;
}
