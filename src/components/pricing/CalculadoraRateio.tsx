import { useState } from "react";
import { Calculator } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CampoNumero } from "@/components/pricing/CampoNumero";
import { formatBRL } from "@/lib/format";
import { ratearParaItem } from "@/lib/nfe/rateio";

interface Props {
  /** Valor sugerido para "valor deste item na nota" (ex.: valorUnitario × quantidade). */
  valorItemSugerido: number;
  /** Quantidade comprada deste item, só para mostrar o valor por unidade no resultado. */
  quantidade: number;
  /** Aplica os valores calculados de volta ao formulário do simulador. */
  onAplicar: (resultado: {
    frete: number;
    seguro: number;
    outras: number;
    desconto: number;
  }) => void;
}

/**
 * Calculadora auxiliar: quando a nota traz frete, seguro, outras despesas ou
 * desconto só no total (não item a item), divide cada total proporcionalmente
 * ao valor deste item — a mesma conta que a importação de XML/PDF já faz
 * automaticamente (`ratearParaItem`), só que para digitação manual.
 */
export function CalculadoraRateio({ valorItemSugerido, quantidade, onAplicar }: Props) {
  const [aberto, setAberto] = useState(false);
  const [valorItem, setValorItem] = useState(valorItemSugerido);
  const [valorTotalNota, setValorTotalNota] = useState(0);
  const [freteNota, setFreteNota] = useState(0);
  const [seguroNota, setSeguroNota] = useState(0);
  const [outrasNota, setOutrasNota] = useState(0);
  const [descontoNota, setDescontoNota] = useState(0);

  const onOpenChange = (v: boolean) => {
    if (v) {
      setValorItem(valorItemSugerido);
      setValorTotalNota(0);
      setFreteNota(0);
      setSeguroNota(0);
      setOutrasNota(0);
      setDescontoNota(0);
    }
    setAberto(v);
  };

  const frete = ratearParaItem(valorItem, valorTotalNota, freteNota);
  const seguro = ratearParaItem(valorItem, valorTotalNota, seguroNota);
  const outras = ratearParaItem(valorItem, valorTotalNota, outrasNota);
  const desconto = ratearParaItem(valorItem, valorTotalNota, descontoNota);

  const linhas: Array<{ rotulo: string; total: number }> = [
    { rotulo: "Frete", total: frete },
    { rotulo: "Seguro", total: seguro },
    { rotulo: "Outras despesas", total: outras },
    { rotulo: "Desconto", total: desconto },
  ];

  const porUnidade = (total: number) => (quantidade > 0 ? formatBRL(total / quantidade) : "—");

  const aplicar = () => {
    onAplicar({
      frete: Number(frete.toFixed(2)),
      seguro: Number(seguro.toFixed(2)),
      outras: Number(outras.toFixed(2)),
      desconto: Number(desconto.toFixed(2)),
    });
    setAberto(false);
  };

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full">
          <Calculator className="size-4" aria-hidden />
          Ratear despesas da nota
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ratear despesas da nota por item</DialogTitle>
          <DialogDescription>
            Se a nota traz o frete, seguro, despesas ou desconto só no total (não por item), divida
            aqui proporcionalmente ao valor deste item antes de preencher os campos do produto.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <CampoNumero
            label="Valor deste item na nota"
            prefixo="R$"
            value={valorItem}
            onChange={setValorItem}
            className="sm:col-span-2"
          />
          <CampoNumero
            label="Valor total da nota (soma de todos os itens)"
            prefixo="R$"
            value={valorTotalNota}
            onChange={setValorTotalNota}
            className="sm:col-span-2"
          />
          <CampoNumero
            label="Frete total da nota"
            prefixo="R$"
            value={freteNota}
            onChange={setFreteNota}
          />
          <CampoNumero
            label="Seguro total da nota"
            prefixo="R$"
            value={seguroNota}
            onChange={setSeguroNota}
          />
          <CampoNumero
            label="Outras despesas totais da nota"
            prefixo="R$"
            value={outrasNota}
            onChange={setOutrasNota}
          />
          <CampoNumero
            label="Desconto total da nota"
            prefixo="R$"
            value={descontoNota}
            onChange={setDescontoNota}
          />
        </div>

        <dl className="grid gap-2 rounded-lg border border-border bg-surface p-3 text-sm">
          {linhas.map((l) => (
            <div key={l.rotulo} className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">{l.rotulo} deste item</dt>
              <dd className="text-right font-semibold tabular-nums text-foreground">
                {formatBRL(l.total)}
                <span className="ml-1.5 font-normal text-muted-foreground">
                  ({porUnidade(l.total)}/un.)
                </span>
              </dd>
            </div>
          ))}
        </dl>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={aplicar}>
            Aplicar aos campos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
