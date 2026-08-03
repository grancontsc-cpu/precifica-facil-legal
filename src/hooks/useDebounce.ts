import { useEffect, useState } from "react";

/**
 * Retorna o valor com atraso, evitando recomputar filtros/consultas
 * a cada tecla digitada. O último valor sempre prevalece.
 */
export function useDebounce<T>(valor: T, atrasoMs = 300): T {
  const [atrasado, setAtrasado] = useState(valor);

  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valor), atrasoMs);
    return () => clearTimeout(t);
  }, [valor, atrasoMs]);

  return atrasado;
}
