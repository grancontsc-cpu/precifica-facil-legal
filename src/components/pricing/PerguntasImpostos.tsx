import { Info } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CampoNumero } from "@/components/pricing/CampoNumero";
import { formatPercent } from "@/lib/format";
import {
  aliquotaIcmsCompra,
  apuraPeloSimplesRegime,
  sugestaoPisCofins,
  tributado,
  type Resposta,
  type RespostasImpostos,
} from "@/lib/impostos-rapido";
import type { Regime, SimulationState } from "@/types/pricing";

const OPCOES: { valor: Resposta; rotulo: string }[] = [
  { valor: "sim", rotulo: "Sim" },
  { valor: "nao", rotulo: "Não" },
  { valor: "naoSei", rotulo: "Não sei" },
];

function Pergunta({
  id,
  titulo,
  descricao,
  valor,
  onChange,
}: {
  id: string;
  titulo: string;
  descricao: string;
  valor: Resposta;
  onChange: (r: Resposta) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">{titulo}</legend>
      <p className="text-xs text-muted-foreground">{descricao}</p>
      <RadioGroup
        value={valor}
        onValueChange={(v) => onChange(v as Resposta)}
        className="flex flex-wrap gap-4 pt-1"
      >
        {OPCOES.map((o) => (
          <div key={o.valor} className="flex items-center gap-2">
            <RadioGroupItem id={`${id}-${o.valor}`} value={o.valor} />
            <Label htmlFor={`${id}-${o.valor}`} className="text-sm font-normal">
              {o.rotulo}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

interface Props {
  state: SimulationState;
  regime: Regime;
  respostas: RespostasImpostos;
  onChange: (r: RespostasImpostos) => void;
  aliquotaSimples: number | null;
  onAliquotaSimples: (valor: number) => void;
}

/**
 * Perguntas simples de tributação do modo rápido. As alíquotas de ICMS já
 * vêm do trajeto informado (origem/destino); no Simples/MEI só a alíquota
 * efetiva do DAS é habilitada.
 */
export function PerguntasImpostos({
  state,
  regime,
  respostas,
  onChange,
  aliquotaSimples,
  onAliquotaSimples,
}: Props) {
  const simples = apuraPeloSimplesRegime(regime);
  const op = state.operacao;
  const sug = sugestaoPisCofins(regime);
  const set = (parcial: Partial<RespostasImpostos>) => onChange({ ...respostas, ...parcial });

  if (simples) {
    return (
      <div className="space-y-4">
        <Alert>
          <Info className="size-4" aria-hidden />
          <AlertDescription>
            No Simples Nacional (e no MEI) o ICMS, o PIS e a Cofins da venda estão dentro do DAS —
            por isso essas perguntas não se aplicam. Informe apenas a alíquota efetiva da sua
            apuração. O ICMS de fronteira continua sendo tratado como custo.
          </AlertDescription>
        </Alert>
        <CampoNumero
          label="Alíquota efetiva do Simples (DAS)"
          sufixo="%"
          value={aliquotaSimples ?? 0}
          onChange={onAliquotaSimples}
          ajuda="Alíquota efetiva do seu anexo, conforme o faturamento dos últimos 12 meses."
        />
      </div>
    );
  }

  const icmsCompra = aliquotaIcmsCompra(state);
  const comIcms = tributado(respostas.icms);
  const comPisCofins = tributado(respostas.pisCofins);

  return (
    <div className="space-y-5">
      <Pergunta
        id="rapido-icms"
        titulo="A mercadoria é tributada pelo ICMS?"
        descricao="Se sim, usamos as alíquotas do trajeto que você já informou."
        valor={respostas.icms}
        onChange={(v) => set({ icms: v })}
      />

      {comIcms ? (
        <dl className="grid gap-2 rounded-lg border border-border bg-background p-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">
              {op?.ufOrigem && op?.ufDestino && op.ufOrigem !== op.ufDestino
                ? "ICMS da compra (interestadual)"
                : "ICMS da compra (interna)"}
            </dt>
            <dd className="num-destaque font-semibold">
              {icmsCompra === null ? "—" : formatPercent(icmsCompra)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">ICMS da venda (interna do destino)</dt>
            <dd className="num-destaque font-semibold">
              {op?.aliquotaInternaDestino === null || op?.aliquotaInternaDestino === undefined
                ? "—"
                : formatPercent(op.aliquotaInternaDestino)}
            </dd>
          </div>
        </dl>
      ) : null}

      <Pergunta
        id="rapido-piscofins"
        titulo="A mercadoria é tributada por PIS e Cofins?"
        descricao={`Sugestão para o seu regime: PIS ${formatPercent(sug.pis)} e Cofins ${formatPercent(sug.cofins)}.`}
        valor={respostas.pisCofins}
        onChange={(v) => set({ pisCofins: v })}
      />

      {comPisCofins ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoNumero
            label="PIS"
            sufixo="%"
            value={respostas.aliquotaPis ?? sug.pis}
            onChange={(v) => set({ aliquotaPis: v })}
          />
          <CampoNumero
            label="Cofins"
            sufixo="%"
            value={respostas.aliquotaCofins ?? sug.cofins}
            onChange={(v) => set({ aliquotaCofins: v })}
          />
        </div>
      ) : null}

      {respostas.icms === "naoSei" || respostas.pisCofins === "naoSei" ? (
        <Alert>
          <Info className="size-4" aria-hidden />
          <AlertDescription>
            Você marcou <strong>“Não sei”</strong>. Para não subestimar o preço, consideramos a
            mercadoria como <strong>tributada</strong>. Confirme com a contabilidade e ajuste
            depois, se necessário.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
