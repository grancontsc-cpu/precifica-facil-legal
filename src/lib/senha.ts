/**
 * Regras de senha do Precifica Grancont.
 * Critérios (todos obrigatórios, em qualquer ordem):
 * mínimo 8 caracteres, maiúscula, minúscula, número, símbolo e sem espaços.
 */

/** Tamanho mínimo exigido em todas as telas de senha. */
export const REGRA_SENHA_TAMANHO_MINIMO = 8;

/**
 * Valida senha + confirmação com as mesmas mensagens em todas as telas.
 * Retorna a mensagem de erro, ou null quando está tudo certo.
 */
export function validarParDeSenhas(senha: string, confirmacao?: string): string | null {
  const problema = mensagemSenhaInvalida(senha);
  if (problema) return problema;
  if (typeof confirmacao === "string" && senha !== confirmacao) {
    return "As senhas não conferem.";
  }
  return null;
}

export type CriterioSenha = {
  id: string;
  rotulo: string;
  ok: boolean;
};

export function avaliarSenha(senha: string): {
  criterios: CriterioSenha[];
  atendidos: number;
  total: number;
  valida: boolean;
} {
  const criterios: CriterioSenha[] = [
    { id: "tamanho", rotulo: `Pelo menos ${REGRA_SENHA_TAMANHO_MINIMO} caracteres`, ok: senha.length >= REGRA_SENHA_TAMANHO_MINIMO },
    { id: "maiuscula", rotulo: "Uma letra maiúscula (A-Z)", ok: /[A-ZÀ-Þ]/.test(senha) },
    { id: "minuscula", rotulo: "Uma letra minúscula (a-z)", ok: /[a-zà-þ]/.test(senha) },
    { id: "numero", rotulo: "Um número (0-9)", ok: /[0-9]/.test(senha) },
    {
      id: "simbolo",
      rotulo: "Um símbolo (ex.: ! @ # $ % & *)",
      ok: /[^A-Za-zÀ-ÿ0-9\s]/.test(senha),
    },
    { id: "espaco", rotulo: "Sem espaços em branco", ok: senha.length > 0 && !/\s/.test(senha) },
  ];

  const atendidos = criterios.filter((c) => c.ok).length;
  return { criterios, atendidos, total: criterios.length, valida: atendidos === criterios.length };
}

/** Mensagem em português para o primeiro critério não atendido. */
export function mensagemSenhaInvalida(senha: string): string | null {
  const { criterios, valida } = avaliarSenha(senha);
  if (valida) return null;
  const faltando = criterios.filter((c) => !c.ok).map((c) => c.rotulo.toLowerCase());
  return `Senha fora dos critérios: ${faltando.join("; ")}.`;
}

/** Traduz erros de senha vindos do serviço de autenticação (em inglês). */
export function traduzirErroSenha(mensagem?: string | null): string | null {
  if (!mensagem) return null;
  const m = mensagem.toLowerCase();
  if (m.includes("should be at least") || m.includes("at least 8")) {
    return "A senha precisa ter pelo menos 8 caracteres.";
  }
  if (m.includes("password") && (m.includes("weak") || m.includes("requirements") || m.includes("characters"))) {
    return "Senha fraca: use maiúscula, minúscula, número e símbolo, sem espaços.";
  }
  if (m.includes("pwned") || m.includes("compromised") || m.includes("leaked")) {
    return "Esta senha aparece em vazamentos públicos. Escolha outra.";
  }
  return null;
}
