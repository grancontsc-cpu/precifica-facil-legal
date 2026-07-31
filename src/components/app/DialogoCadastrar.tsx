import { useNavigate } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  aberto: boolean;
  email: string;
  onFechar: () => void;
}

/** Convite para criar conta quando o e-mail informado ainda não existe. */
export function DialogoCadastrar({ aberto, email, onFechar }: Props) {
  const navigate = useNavigate();

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" aria-hidden />
            E-mail ainda não cadastrado
          </DialogTitle>
          <DialogDescription>
            Não encontramos uma conta para <span className="font-medium text-foreground">{email}</span>. Deseja
            cadastrar agora? Você recebe 30 dias de teste gratuito, sem limites.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onFechar} className="w-full sm:w-auto">
            Agora não
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={() => {
              onFechar();
              navigate({ to: "/cadastrar", search: { email } });
            }}
          >
            Cadastrar agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
