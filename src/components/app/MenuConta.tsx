import { Link } from "@tanstack/react-router";
import { LogOut, Monitor, Moon, Sun, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NOME_PAPEL, useApp } from "@/hooks/useApp";
import { useTema, type Tema } from "@/hooks/useTema";

function iniciais(texto: string | null) {
  if (!texto) return "?";
  const limpo = texto.trim();
  const partes = limpo.split(/[\s@.]+/).filter(Boolean);
  return (partes[0]?.[0] ?? "?").toUpperCase() + (partes[1]?.[0] ?? "").toUpperCase();
}

export function MenuConta() {
  const { email, nome, papel, signOut } = useApp();
  const { tema, setTema } = useTema();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 w-10 rounded-full bg-surface-strong p-0 text-sm font-semibold text-foreground"
          aria-label="Minha conta"
        >
          {iniciais(nome ?? email)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="space-y-0.5">
          <span className="block truncate text-sm font-semibold text-foreground">{nome ?? "Minha conta"}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">{email}</span>
          <span className="block text-xs font-normal text-primary">{NOME_PAPEL[papel]}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Aparência</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={tema} onValueChange={(v) => setTema(v as Tema)}>
          <DropdownMenuRadioItem value="claro">
            <Sun className="mr-2 h-4 w-4" aria-hidden />
            Claro
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="escuro">
            <Moon className="mr-2 h-4 w-4" aria-hidden />
            Escuro
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="sistema">
            <Monitor className="mr-2 h-4 w-4" aria-hidden />
            Igual ao aparelho
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/simulacoes">
            <UserRound className="mr-2 h-4 w-4" aria-hidden />
            Minhas simulações
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut className="mr-2 h-4 w-4" aria-hidden />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
