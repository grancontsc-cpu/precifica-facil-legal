import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  montarTabela,
  tabelaVazia,
  type LinhaInterestadual,
  type LinhaInterna,
  type TabelaAliquotas,
} from "@/lib/aliquotas";

/**
 * Carrega as alíquotas de ICMS vigentes (internas e interestaduais) do banco.
 * Nenhum valor é fixado no código: a tabela é versionada por vigência e
 * mantida pelo Administrador Geral.
 */
export function useAliquotas() {
  const query = useQuery({
    queryKey: ["aliquotas", "icms"],
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<TabelaAliquotas> => {
      const [internas, interestaduais] = await Promise.all([
        supabase
          .from("icms_aliquotas_internas")
          .select("uf, aliquota, fcp, vigencia_inicio, vigencia_fim, fonte, observacao"),
        supabase
          .from("icms_aliquotas_interestaduais")
          .select(
            "uf_origem, uf_destino, aliquota, aliquota_importado, vigencia_inicio, vigencia_fim, fonte",
          ),
      ]);
      if (internas.error) throw internas.error;
      if (interestaduais.error) throw interestaduais.error;
      return montarTabela(
        (internas.data ?? []) as unknown as LinhaInterna[],
        (interestaduais.data ?? []) as unknown as LinhaInterestadual[],
      );
    },
  });

  return {
    tabela: query.data ?? tabelaVazia(),
    carregando: query.isLoading,
    erro: query.error as Error | null,
  };
}
