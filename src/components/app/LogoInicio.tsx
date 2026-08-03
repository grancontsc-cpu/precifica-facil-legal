import { useCallback, useRef, useState } from "react";
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
  const linkRef = useRef<HTMLAnchorElement | null>(null);
  // Evita devolver o foco ao link quando o fechamento acontece por navegação.
  const navegando = useRef(false);

  // Texto lido pelo leitor de tela como descrição (aria-describedby) do link.
  const dica = pendente
    ? "Há alterações não salvas — pediremos confirmação antes de voltar ao simulador"
    : naRotaInicial
      ? "Você já está no simulador"
      : "Ir para o simulador de precificação";

  const irParaSimulador = () =>
    void navigate({ to: "/simulador", search: { simulacao: undefined, produto: undefined } });

  /**
   * Fecha a dica e devolve o foco ao link. Necessário porque a dica pode ser
   * fechada por Esc, por clique fora ou pela abertura da confirmação — em
   * todos os casos o teclado deve continuar do mesmo ponto da ordem de tab.
   */
  const fecharTooltip = useCallback((devolverFoco = true) => {
    setTooltipAberto(false);
    if (devolverFoco) linkRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip open={tooltipAberto} onOpenChange={setTooltipAberto}>
          <TooltipTrigger asChild>
            <Link
              ref={linkRef}
              to="/simulador"
              search={{ simulacao: undefined, produto: undefined }}
              className={cn(
                "flex min-h-11 shrink-0 basis-auto items-center whitespace-nowrap rounded-md px-2 py-1.5 transition-all",
                "max-w-[60vw] sm:max-w-none",
                naRotaInicial ? "bg-primary/15 ring-1 ring-primary/50" : "hover:opacity-80",
              )}
              aria-label="Precifica Grancont — ir para o simulador"
              aria-current={naRotaInicial ? "page" : undefined}
              // Esc fecha a dica sem sair do link (o cabeçalho continua na ordem de tab).
              onKeyDown={(e) => {
                if (e.key === "Escape" && tooltipAberto) {
                  e.stopPropagation();
                  fecharTooltip();
                }
              }}
              onClick={(e) => {
                setTooltipAberto(false);
                if (!pendente) return;
                e.preventDefault();
                setConfirmando(true);
              }}
            >
              <LogoGrancont className="h-7 sm:h-8" decorativa />
            </Link>
          </TooltipTrigger>
          {/* A dica é apenas visual: o Radix já associa a descrição ao link,
              e o nome acessível do link não repete esse texto. */}
          <TooltipContent
            side="bottom"
            align="start"
            // A dica nunca recebe foco: o Tab sai do link direto para o próximo
            // item do cabeçalho, sem parada intermediária.
            tabIndex={-1}
            onEscapeKeyDown={(e) => {
              e.preventDefault();
              fecharTooltip();
            }}
            onPointerDownOutside={() => fecharTooltip(false)}
          >
            {dica}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <AlertDialog
        open={confirmando}
        onOpenChange={(aberto) => {
          setConfirmando(aberto);
          // Ao fechar a confirmação por Esc ou clique fora, o foco volta ao link.
          if (!aberto && !navegando.current) fecharTooltip();
          if (aberto) navegando.current = false;
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações não salvas?</AlertDialogTitle>
            <AlertDialogDescription>
              Existem alterações no formulário que ainda não foram salvas. Se voltar ao simulador
              agora, elas serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // Navegação intencional: não devolve o foco ao link, a nova
                // rota assume a ordem de tab.
                navegando.current = true;
                setConfirmando(false);
                setTooltipAberto(false);
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
