import { useId } from "react";

import { ForcaSenha } from "@/components/app/ForcaSenha";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { REGRA_SENHA_TAMANHO_MINIMO } from "@/lib/senha";
import { cn } from "@/lib/utils";

/**
 * Campos padrão de senha (e confirmação) usados em TODAS as telas que criam
 * ou alteram senha. Apenas apresentação — as regras vivem em @/lib/senha.
 */
export function CamposSenha({
  senha,
  onSenhaChange,
  confirmacao,
  onConfirmacaoChange,
  rotulo = "Senha",
  rotuloConfirmacao = "Confirmar senha",
  idSenha,
  className,
  disabled,
}: {
  senha: string;
  onSenhaChange: (valor: string) => void;
  confirmacao?: string;
  onConfirmacaoChange?: (valor: string) => void;
  rotulo?: string;
  rotuloConfirmacao?: string;
  idSenha?: string;
  className?: string;
  disabled?: boolean;
}) {
  const autoId = useId();
  const campoId = idSenha ?? `senha-${autoId}`;
  const indicadorId = `${campoId}-forca`;
  const confirmacaoId = `${campoId}-confirmacao`;
  const mostrarConfirmacao = typeof confirmacao === "string" && !!onConfirmacaoChange;
  const divergente = mostrarConfirmacao && confirmacao.length > 0 && confirmacao !== senha;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-1.5">
        <Label htmlFor={campoId}>{rotulo}</Label>
        <Input
          id={campoId}
          type="password"
          autoComplete="new-password"
          minLength={REGRA_SENHA_TAMANHO_MINIMO}
          value={senha}
          onChange={(e) => onSenhaChange(e.target.value)}
          aria-describedby={indicadorId}
          disabled={disabled}
          required
        />
        <ForcaSenha senha={senha} id={indicadorId} className="pt-1" />
      </div>

      {mostrarConfirmacao ? (
        <div className="space-y-1.5">
          <Label htmlFor={confirmacaoId}>{rotuloConfirmacao}</Label>
          <Input
            id={confirmacaoId}
            type="password"
            autoComplete="new-password"
            minLength={REGRA_SENHA_TAMANHO_MINIMO}
            value={confirmacao}
            onChange={(e) => onConfirmacaoChange?.(e.target.value)}
            aria-invalid={divergente || undefined}
            aria-describedby={divergente ? `${confirmacaoId}-erro` : undefined}
            disabled={disabled}
            required
          />
          {divergente ? (
            <p id={`${confirmacaoId}-erro`} role="alert" className="text-xs text-destructive">
              As senhas não conferem.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
