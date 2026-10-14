import { useMemo, useState } from "react";
import { Calculator, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { contextoParaPergunta } from "@/lib/contexto-pergunta";
import { perguntarSobreSimulacao } from "@/lib/perguntas.functions";
import type { SimulationState } from "@/types/pricing";

type Mensagem = { papel: "contador" | "assistente"; texto: string };

const SUGESTOES = [
  "Em que ano o lucro deste produto mais cai se eu mantiver o preço?",
  "Quanto preciso reajustar o preço em 2027 e em 2033 para manter o lucro?",
  "Explique para o cliente, em linguagem simples, o impacto da Reforma neste produto.",
];

/** Perguntas em texto livre sobre a simulação aberta, respondidas com os números do motor. */
export function PerguntasContador({ state }: { state: SimulationState }) {
  const contexto = useMemo(() => contextoParaPergunta(state), [state]);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [pergunta, setPergunta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(texto: string) {
    const q = texto.trim();
    if (q.length < 3 || !contexto || enviando) return;
    setErro(null);
    setEnviando(true);
    setPergunta("");
    const historico = mensagens.slice(-10);
    setMensagens((m) => [...m, { papel: "contador", texto: q }]);
    try {
      const r = await perguntarSobreSimulacao({
        data: { pergunta: q, contexto: contexto as unknown as Record<string, unknown>, historico },
      });
      if (r.resposta) setMensagens((m) => [...m, { papel: "assistente", texto: r.resposta! }]);
      else setErro(r.erro);
    } catch {
      setErro("Não foi possível enviar a pergunta. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (!contexto) {
    return (
      <p className="text-sm text-muted-foreground">
        Preencha o produto e o preço para fazer perguntas sobre os impactos anuais.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Pergunte sobre os impactos ano a ano no lucro. As respostas usam apenas os resultados
        calculados nesta simulação — confira antes de repassar ao cliente.
      </p>

      {mensagens.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {SUGESTOES.map((s) => (
            <Button key={s} type="button" variant="outline" size="sm" className="h-auto whitespace-normal text-left" onClick={() => void enviar(s)}>
              {s}
            </Button>
          ))}
        </div>
      )}

      <div className="space-y-3" aria-live="polite">
        {mensagens.map((m, i) =>
          m.papel === "contador" ? (
            <div key={i} className="ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
              {m.texto}
            </div>
          ) : (
            <div key={i} className="flex gap-2 text-sm">
              <Calculator className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="whitespace-pre-wrap leading-relaxed">{m.texto}</div>
            </div>
          ),
        )}
        {enviando && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Analisando os resultados…
          </p>
        )}
        {erro && <p className="text-sm text-destructive">{erro}</p>}
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar(pergunta);
        }}
      >
        <Textarea
          aria-label="Sua pergunta sobre a simulação"
          placeholder="Ex.: quanto o lucro cai em 2029 se eu não reajustar?"
          value={pergunta}
          maxLength={1500}
          rows={2}
          onChange={(e) => setPergunta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void enviar(pergunta);
            }
          }}
        />
        <Button type="submit" size="icon" disabled={enviando || pergunta.trim().length < 3} aria-label="Enviar pergunta">
          <Send className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
    </div>
  );
}
