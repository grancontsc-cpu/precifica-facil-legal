import { useState } from "react";
import { Copy, FileDown, FileSpreadsheet, Printer, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RelatorioSimulacao } from "@/components/report/RelatorioSimulacao";
import {
  baixarArquivo,
  csvRelatorio,
  montarRelatorio,
  nomeArquivo,
  whatsappRelatorio,
  type RelatorioMeta,
} from "@/lib/report";
import {
  eventoComparacaoRelatorio,
  eventoCopiarResultado,
  eventoExportarRelatorio,
} from "@/lib/analytics-eventos";
import { Switch } from "@/components/ui/switch";
import type { SupplierComparison } from "@/types/comparison";
import type { SimulationResult, SimulationState } from "@/types/pricing";

interface Props {
  state: SimulationState;
  resultado: SimulationResult;
  meta: Omit<RelatorioMeta, "observacoes">;
  comparacao?: SupplierComparison | null;
}

export function ExportarSimulacao({ state, resultado, meta, comparacao }: Props) {
  const [aberto, setAberto] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [incluirComparacao, setIncluirComparacao] = useState(true);

  const comparacaoAtiva = comparacao && incluirComparacao ? comparacao : null;
  const rel = montarRelatorio(state, resultado, { ...meta, observacoes }, comparacaoAtiva);

  const comComparacao = !!comparacaoAtiva;

  const copiar = async (texto: string, mensagem: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      eventoCopiarResultado({ conteudo: "resumo_whatsapp", sucesso: true });
      toast.success(mensagem);
    } catch {
      eventoCopiarResultado({ conteudo: "resumo_whatsapp", sucesso: false });
      toast.error("Não foi possível copiar. Selecione o texto manualmente.");
    }
  };

  const imprimir = (formato: "imprimir" | "pdf") => {
    eventoExportarRelatorio({ formato, comComparacao });
    window.print();
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Exportar</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader className="rel-nao-imprimir">
          <DialogTitle>Exportar simulação</DialogTitle>
          <DialogDescription>
            Relatório completo com memória de cálculo — imprima, gere PDF, exporte CSV ou copie o
            resumo para WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="rel-nao-imprimir space-y-2">
          <Label htmlFor="rel-obs">Observações do relatório</Label>
          <Textarea
            id="rel-obs"
            rows={3}
            value={observacoes}
            placeholder="Ex.: preço válido para o lote atual; frete negociado até 30/09."
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </div>

        {comparacao ? (
          <div className="rel-nao-imprimir flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <Label htmlFor="rel-comparacao" className="text-sm font-medium">
              Incluir comparação de fornecedores
              <span className="block text-xs font-normal text-muted-foreground">
                {comparacao.linhas.length} fornecedores comparados nesta simulação.
              </span>
            </Label>
            <Switch
              id="rel-comparacao"
              checked={incluirComparacao}
              onCheckedChange={(v) => {
                setIncluirComparacao(v);
                eventoComparacaoRelatorio({
                  ativo: v,
                  fornecedores: comparacao.linhas.length,
                });
              }}
            />
          </div>
        ) : null}


        <div className="rel-nao-imprimir flex flex-wrap gap-2">
          <Button size="sm" onClick={() => imprimir("imprimir")}>
            <Printer className="h-4 w-4" aria-hidden />
            Imprimir
          </Button>
          <Button size="sm" variant="outline" onClick={() => imprimir("pdf")}>
            <FileDown className="h-4 w-4" aria-hidden />
            Gerar PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              eventoExportarRelatorio({ formato: "csv", comComparacao });
              baixarArquivo(csvRelatorio(rel), nomeArquivo(rel, "csv"), "text/csv;charset=utf-8");
              toast.success("CSV exportado.");
            }}
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            Exportar CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              eventoExportarRelatorio({ formato: "whatsapp", comComparacao });
              void copiar(whatsappRelatorio(rel), "Resumo copiado para o WhatsApp.");
            }}
          >
            <Copy className="h-4 w-4" aria-hidden />
            Copiar resumo WhatsApp
          </Button>
        </div>

        <p className="rel-nao-imprimir text-xs text-muted-foreground">
          Para PDF, escolha “Salvar como PDF” na janela de impressão.
        </p>

        <div className="rounded-lg border border-border">
          <RelatorioSimulacao rel={rel} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
