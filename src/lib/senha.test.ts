/**
 * Testes da política de senha (motor de validação).
 * Critérios: 8+ caracteres, maiúscula, minúscula, número, símbolo e sem espaços.
 */
import { describe, expect, it } from "vitest";

import {
  REGRA_SENHA_TAMANHO_MINIMO,
  avaliarSenha,
  mensagemSenhaInvalida,
  traduzirErroSenha,
  validarParDeSenhas,
} from "@/lib/senha";

const ok = (senha: string, id: string) =>
  avaliarSenha(senha).criterios.find((c) => c.id === id)?.ok ?? false;

describe("avaliarSenha — critérios individuais", () => {
  it("tamanho mínimo é 8", () => {
    expect(REGRA_SENHA_TAMANHO_MINIMO).toBe(8);
    expect(ok("Ab1!def", "tamanho")).toBe(false);
    expect(ok("Ab1!defg", "tamanho")).toBe(true);
  });

  it("exige letra maiúscula", () => {
    expect(ok("ab1!defg", "maiuscula")).toBe(false);
    expect(ok("Ab1!defg", "maiuscula")).toBe(true);
  });

  it("aceita maiúscula acentuada", () => {
    expect(ok("Ável1!ab", "maiuscula")).toBe(true);
  });

  it("exige letra minúscula", () => {
    expect(ok("AB1!DEFG", "minuscula")).toBe(false);
    expect(ok("AB1!DEFg", "minuscula")).toBe(true);
  });

  it("exige número", () => {
    expect(ok("Abcd!efg", "numero")).toBe(false);
    expect(ok("Abcd!ef1", "numero")).toBe(true);
  });

  it("exige símbolo", () => {
    expect(ok("Abcd1efg", "simbolo")).toBe(false);
    for (const s of ["!", "@", "#", "$", "%", "&", "*", "-", "_", "?"]) {
      expect(ok(`Abcd1ef${s}`, "simbolo")).toBe(true);
    }
  });

  it("não aceita espaços em nenhuma posição", () => {
    expect(ok("Ab1! defg", "espaco")).toBe(false);
    expect(ok(" Ab1!defg", "espaco")).toBe(false);
    expect(ok("Ab1!defg ", "espaco")).toBe(false);
    expect(ok("Ab1!defg\t", "espaco")).toBe(false);
    expect(ok("Ab1!defg", "espaco")).toBe(true);
  });

  it("senha vazia não atende nenhum critério", () => {
    const r = avaliarSenha("");
    expect(r.atendidos).toBe(0);
    expect(r.valida).toBe(false);
  });

  it("sempre retorna os 6 critérios", () => {
    expect(avaliarSenha("qualquer").total).toBe(6);
  });
});

describe("avaliarSenha — validade final", () => {
  const validas = ["Abcd1234!", "Xy9#zzzz", "Senha@2026", "aA1!aA1!"];
  const invalidas = [
    "abcdefgh",
    "ABCDEFGH",
    "12345678",
    "!!!!!!!!",
    "Ab1!ab",
    "Abcdefg1",
    "Abcdefg!",
    "Abcd 1a!",
  ];

  it.each(validas)("aceita %s", (senha) => {
    expect(avaliarSenha(senha).valida).toBe(true);
    expect(mensagemSenhaInvalida(senha)).toBeNull();
  });

  it.each(invalidas)("rejeita %s", (senha) => {
    expect(avaliarSenha(senha).valida).toBe(false);
    expect(mensagemSenhaInvalida(senha)).toContain("Senha fora dos critérios");
  });

  it("a mensagem lista todos os critérios pendentes, em português", () => {
    const msg = mensagemSenhaInvalida("abc") ?? "";
    expect(msg).toContain("pelo menos 8 caracteres");
    expect(msg).toContain("maiúscula");
    expect(msg).toContain("número");
    expect(msg).toContain("símbolo");
  });
});

describe("validarParDeSenhas — mesma política em todas as telas", () => {
  it("erro de critério tem prioridade sobre a confirmação", () => {
    expect(validarParDeSenhas("abc", "outra")).toContain("Senha fora dos critérios");
  });

  it("acusa senhas divergentes", () => {
    expect(validarParDeSenhas("Abcd1234!", "Abcd1234")).toBe("As senhas não conferem.");
  });

  it("aceita par válido e idêntico", () => {
    expect(validarParDeSenhas("Abcd1234!", "Abcd1234!")).toBeNull();
  });

  it("funciona sem campo de confirmação", () => {
    expect(validarParDeSenhas("Abcd1234!")).toBeNull();
  });
});

describe("traduzirErroSenha", () => {
  it("traduz erro de tamanho", () => {
    expect(traduzirErroSenha("Password should be at least 8 characters")).toContain("8 caracteres");
  });

  it("traduz senha vazada", () => {
    expect(traduzirErroSenha("This password is known to be pwned")).toContain("vazamentos");
  });

  it("devolve null quando não reconhece a mensagem", () => {
    expect(traduzirErroSenha("Network error")).toBeNull();
    expect(traduzirErroSenha(undefined)).toBeNull();
  });
});
