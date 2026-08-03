import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ContextoPendencias = {
  /** Verdadeiro quando há edições no formulário ainda não salvas. */
  pendente: boolean;
  /** Registra (ou limpa) a existência de alterações não salvas. */
  registrarPendencia: (valor: boolean) => void;
};

const Ctx = createContext<ContextoPendencias>({
  pendente: false,
  registrarPendencia: () => {},
});

export function ProvedorAlteracoesPendentes({ children }: { children: React.ReactNode }) {
  const [pendente, setPendente] = useState(false);
  const registrarPendencia = useCallback((valor: boolean) => {
    setPendente((atual) => (atual === valor ? atual : valor));
  }, []);
  const valor = useMemo(() => ({ pendente, registrarPendencia }), [pendente, registrarPendencia]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAlteracoesPendentes() {
  return useContext(Ctx);
}
