import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LogoGrancont } from "@/components/app/LogoGrancont";
import { useAlteracoesPendentes } from "@/hooks/useAlteracoesPendentes";
import { cn } from "@/lib/utils";

/**
 * Logomarca do cabeçalho que leva ao simulador.
 * Quando existem alterações não salvas no formulário, pede confirmação
 * antes de navegar para evitar perda acidental de dados.
 */
export function LogoInicio({ naRotaInicial }: { naRotaInicial: boolean }) {
  const navigate = useNavigate();
  const { pendente } = useAlteracoesPendentes();
  const [confirmando, setConfirmando] = useState(false);
  const [tooltipAberto, setTooltipAberto] = useState(false);

  // Texto lido pelo leitor de tela como descrição (aria-describedby) do link.
  const dica = pendente
    ? "Há alterações não salvas — pediremos confirmação antes de voltar ao simulador"
    : naRotaInicial
      ? "Você já está no simulador"
      : "Ir para o simulador de precificação";

  const irParaSimulador = () =>
    void navigate({ to: "/simulador", search: { simulacao: undefined, produto: undefined } });

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip open={tooltipAberto} onOpenChange={setTooltipAberto}>
          <TooltipTrigger asChild>
            <Link
              to="/simulador"
              search={{ simulacao: undefined, produto: undefined }}
              className={cn(
                "flex shrink-0 basis-auto items-center whitespace-nowrap rounded-md px-1.5 py-1 transition-all",
                "max-w-[45vw] sm:max-w-none",
                naRotaInicial ? "bg-primary/10 ring-1 ring-primary/30" : "hover:opacity-80",
              )}
              aria-label="Precifica Grancont — ir para o simulador"
              aria-current={naRotaInicial ? "page" : undefined}
              onClick={(e) => {
                if (!pendente) return;
                e.preventDefault();
                setConfirmando(true);
              }}
            >
              <LogoGrancont className="h-6 sm:h-7" decorativa />
            </Link>
          </TooltipTrigger>
          {/* A dica é apenas visual: o Radix já associa a descrição ao link,
              e o nome acessível do link não repete esse texto. */}
          <TooltipContent side="bottom" align="start">
            {dica}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>


      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações não salvas?</AlertDialogTitle>
            <AlertDialogDescription>
              Existem alterações no formulário que ainda não foram salvas. Se voltar ao
              simulador agora, elas serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmando(false);
                irParaSimulador();
              }}
            >
              Sair sem salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
