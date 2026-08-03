"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        // Legibilidade em telas pequenas: texto de 13px, entrelinha folgada e
        // largura máxima que acompanha a viewport (quebra em linhas em vez de
        // vazar da tela). Com fonte ampliada (até 200%) a largura acompanha o
        // tamanho do texto (em `em`) e o conteúdo rola em vez de estourar.
        "z-50 max-h-[min(20rem,calc(100vh-4rem))] max-w-[min(24em,calc(100vw-1.5rem))] overflow-y-auto overflow-x-hidden text-pretty break-words rounded-md bg-primary px-[0.9em] py-[0.55em] text-[0.8125rem] leading-snug text-primary-foreground shadow-lg animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-tooltip-content-transform-origin)",

        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
