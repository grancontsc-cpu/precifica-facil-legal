import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Send, ShieldQuestion } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  AREAS_ADMIN,
  solicitarAcessoAdmin,
  type AreaAdmin,
} from "@/lib/solicitacao-admin.functions";

/**
 * Formulário de solicitação de acesso administrativo. O pedido é registrado
 * no servidor com a identidade da sessão e encaminhado ao Administrador Geral.
 */
export function SolicitarAcessoAdmin({ className }: { className?: string }) {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);
  const [aberto, setAberto] = useState(false);
  const [area, setArea] = useState<AreaAdmin>("painel_admin");
  const [mensagem, setMensagem] = useState("");
  const [contato, setContato] = useState("");
  const enviar = useServerFn(solicitarAcessoAdmin);

  const solicitacao = useMutation({
    mutationFn: async () =>
      enviar({ data: { area, mensagem: mensagem.trim(), contato: contato.trim() || undefined } }),
    onSuccess: (r) => {
      setAberto(false);
      setMensagem("");
      toast.success(
        r.duplicado
          ? "Você já tem uma solicitação em análise para esta área."
          : "Solicitação enviada ao Administrador Geral.",
      );
    },
    onError: () => toast.error("Não foi possível enviar a solicitação. Tente novamente."),
  });

  const mensagemValida = mensagem.trim().length >= 10;

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button className={className}>
          <ShieldQuestion className="h-4 w-4" aria-hidden />
          Solicitar acesso ao painel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar acesso ao painel</DialogTitle>
          <DialogDescription>
            Seu pedido é encaminhado ao Administrador Geral com seu e-mail, o motivo e a data do
            envio.
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
            <Label htmlFor="admin-email">Seu e-mail</Label>
            <Input id="admin-email" value={email ?? "—"} readOnly className="text-xs sm:text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-area">Área desejada</Label>
            <Select value={area} onValueChange={(v) => setArea(v as AreaAdmin)}>
              <SelectTrigger id="admin-area">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AREAS_ADMIN).map(([valor, rotulo]) => (
                  <SelectItem key={valor} value={valor}>
                    {rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-motivo">Motivo da solicitação</Label>
            <Textarea
              id="admin-motivo"
              required
              minLength={10}
              maxLength={1000}
              rows={4}
              placeholder="Explique por que você precisa deste acesso."
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-contato">Contato para retorno (opcional)</Label>
            <Input
              id="admin-contato"
              maxLength={160}
              placeholder="E-mail alternativo ou telefone"
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
