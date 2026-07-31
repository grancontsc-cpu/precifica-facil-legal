import { metaPagina } from "@/lib/seo-head";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { LogoGrancont } from "@/components/app/LogoGrancont";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { concluirOnboarding } from "@/lib/onboarding.functions";

const TITULO = "Concluir cadastro — Precifica Grancont";
const DESCRICAO =
  "Informe seus dados e os da empresa para ativar o Precifica Grancont e iniciar os 30 dias de teste gratuito.";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    ...metaPagina({
      titulo: TITULO,
      descricao: DESCRICAO,
      caminho: "/onboarding",
    }),
  }),
  ssr: false,
  component: OnboardingPage,
});

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

function OnboardingPage() {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [uf, setUf] = useState("SP");
  const [cidade, setCidade] = useState("");
  const [aceite, setAceite] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aceite) {
      toast.error("É preciso aceitar os termos de uso e a política de privacidade.");
      return;
    }
    setCarregando(true);
    try {
      const { data: sessao } = await supabase.auth.getUser();
      if (!sessao.user) {
        navigate({ to: "/login", replace: true });
        return;
      }

      const resultado = await concluirOnboarding({
        data: {
          nomeCompleto: nome.trim(),
          nomeEmpresa: empresa.trim(),
          cnpj: cnpj.trim() || undefined,
          uf,
          cidade: cidade.trim() || undefined,
          versaoTermos: "1.0",
          versaoPrivacidade: "1.0",
        },
      });

      switch (resultado.status) {
        case "email_nao_confirmado":
          navigate({ to: "/confirmar-email", replace: true });
          return;
        case "vinculo_pendente":
          toast.success("Encontramos sua empresa. O gestor precisa aprovar seu acesso.");
          navigate({ to: "/aguardando-aprovacao", replace: true });
          return;
        case "teste_ja_utilizado":
          toast.info("O teste gratuito já foi utilizado para esta empresa.");
          navigate({ to: "/entrando", replace: true });
          return;
        default:
          toast.success("Cadastro concluído. Bom trabalho!");
          navigate({ to: "/entrando", replace: true });
      }
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível concluir o cadastro.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
        <LogoGrancont className="h-9 w-auto" />
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-foreground">Vamos concluir seu cadastro</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Precisamos de poucos dados para preparar sua empresa e liberar os 30 dias de teste gratuito.
        </p>

        <form className="mt-6 space-y-4" onSubmit={enviar}>
          <div className="space-y-1.5">
            <Label htmlFor="nome">Seu nome completo</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={150} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="empresa">Nome da empresa</Label>
            <Input
              id="empresa"
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              required
              maxLength={150}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cnpj">CNPJ (opcional)</Label>
              <Input
                id="cnpj"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                inputMode="numeric"
                maxLength={20}
                placeholder="00.000.000/0000-00"
              />
              <p className="text-xs text-muted-foreground">
                Se a empresa já existir no sistema, seu acesso vai para aprovação do gestor.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uf">Estado (UF)</Label>
              <select
                id="uf"
                value={uf}
                onChange={(e) => setUf(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                {UFS.map((sigla) => (
                  <option key={sigla} value={sigla}>
                    {sigla}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cidade">Cidade (opcional)</Label>
            <Input id="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} maxLength={120} />
          </div>

          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={aceite}
              onChange={(e) => setAceite(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input"
            />
            <span>Li e aceito os termos de uso e a política de privacidade do Precifica Grancont.</span>
          </label>

          <Button type="submit" className="w-full" disabled={carregando}>
            {carregando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Concluir e liberar meu teste
          </Button>
        </form>

        <div className="mt-6 grid gap-2 text-xs text-muted-foreground">
          <p className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> Seus dados ficam isolados por empresa.
          </p>
          <p className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" aria-hidden /> Você pode convidar sua equipe depois.
          </p>
        </div>
      </div>
    </main>
  );
}
