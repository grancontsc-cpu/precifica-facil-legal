import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { solicitarAcessoSimulacao } from "@/lib/solicitacao-acesso.functions";
import type { CodigoAcesso } from "@/lib/acesso-simulacao";

interface SolicitarAcessoProps {
  /** Id da simulação que o usuário tentou abrir (vem da URL). */
  simulacaoId?: string | null;
  motivoCodigo: CodigoAcesso;
}

/**
 * Botão + formulário de solicitação de acesso. O envio é feito no servidor
 * (identidade verificada) e encaminhado à equipe responsável; a tela não
 * exibe nenhum dado da simulação além do id informado na URL.
 */
export function SolicitarAcesso({ simulacaoId, motivoCodigo }: SolicitarAcessoProps) {
  const [aberto, setAberto] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [contato, setContato] = useState("");
  const enviar = useServerFn(solicitarAcessoSimulacao);

  const solicitacao = useMutation({
    mutationFn: async () =>
      enviar({
        data: {
          simulacaoId: simulacaoId ?? null,
          motivoCodigo,
          mensagem: mensagem.trim(),
          contato: contato.trim() || undefined,
        },
      }),
    onSuccess: (r) => {
      setAberto(false);
      setMensagem("");
      toast.success(
        r.duplicado
          ? "Você já tem uma solicitação em análise para esta simulação."
          : "Solicitação enviada para a equipe responsável.",
      );
    },
    onError: () => toast.error("Não foi possível enviar a solicitação. Tente novamente."),
  });

  const mensagemValida = mensagem.trim().length >= 10;

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">Solicitar acesso</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar acesso</DialogTitle>
          <DialogDescription>
            Seu pedido é enviado à equipe responsável, com seu usuário e a data do envio.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (mensagemValida) solicitacao.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="solicitacao-id">ID da simulação</Label>
            <Input id="solicitacao-id" value={simulacaoId ?? "—"} readOnly className="font-mono text-xs" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="solicitacao-mensagem">Motivo da solicitação</Label>
            <Textarea
              id="solicitacao-mensagem"
              required
              minLength={10}
              maxLength={1000}
              rows={4}
              placeholder="Explique por que você precisa acessar esta simulação."
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="solicitacao-contato">Contato para retorno (opcional)</Label>
            <Input
              id="solicitacao-contato"
              maxLength={160}
              placeholder="E-mail ou telefone"
              value={contato}
              onChange={(e) => setContato(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!mensagemValida || solicitacao.isPending}>
              <Send className="h-4 w-4" aria-hidden />
              {solicitacao.isPending ? "Enviando…" : "Enviar solicitação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
