import { BookOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const TERMOS: { termo: string; texto: string }[] = [
  {
    termo: "Desembolso",
    texto:
      "Todo o dinheiro que sai do seu caixa na compra: mercadoria, frete, seguro e tributos pagos por fora.",
  },
  {
    termo: "Crédito recuperável",
    texto:
      "A parte dos tributos da compra que a sua empresa pode abater do que deve ao governo. Só existe quando o regime permite.",
  },
  {
    termo: "Custo líquido",
    texto:
      "Desembolso menos os créditos recuperáveis. É o custo real do produto para a sua empresa.",
  },
  {
    termo: "Tributo incluído (por dentro)",
    texto: "Já está dentro do preço combinado com o fornecedor. Não aumenta o valor da nota.",
  },
  {
    termo: "Tributo por fora",
    texto: "É somado ao preço combinado, como o ICMS-ST. Aumenta o valor que você paga.",
  },
  {
    termo: "Tributo informativo",
    texto: "Aparece na nota apenas para informação e não altera o quanto você paga nem o crédito.",
  },
  {
    termo: "Base de cálculo",
    texto: "O valor sobre o qual a alíquota é aplicada. Pode ser reduzida em alguns casos.",
  },
  {
    termo: "Alíquota",
    texto: "O percentual do tributo. Ter alíquota não significa, por si só, ter direito a crédito.",
  },
  {
    termo: "Margem desejada",
    texto:
      "Quanto você quer ganhar sobre a venda. O sistema calcula o preço que entrega essa margem.",
  },
  {
    termo: "Markup",
    texto: "Quantas vezes o custo é multiplicado para chegar ao preço de venda.",
  },
  {
    termo: "Preço mínimo",
    texto: "O preço em que a venda não dá lucro nem prejuízo. Abaixo dele você perde dinheiro.",
  },
  {
    termo: "Perfil tributário",
    texto:
      "Um conjunto de tributos já configurado para a empresa. Simulações salvas guardam uma cópia do perfil usado na época.",
  },
];

export function Glossario({ variant = "ghost" }: { variant?: "ghost" | "outline" }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant={variant} size="sm" className="gap-2">
          <BookOpen className="h-4 w-4" aria-hidden />
          Glossário
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Glossário em linguagem simples</SheetTitle>
          <SheetDescription>
            O que cada termo do sistema quer dizer, sem juridiquês.
          </SheetDescription>
        </SheetHeader>
        <dl className="space-y-4 px-4 pb-8">
          {TERMOS.map((t) => (
            <div key={t.termo} className="rounded-lg border border-border bg-surface p-3">
              <dt className="text-sm font-semibold text-foreground">{t.termo}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.texto}</dd>
            </div>
          ))}
        </dl>
      </SheetContent>
    </Sheet>
  );
}
