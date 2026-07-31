// @vitest-environment jsdom
/**
 * Testes de interface do medidor de senha e dos campos compartilhados:
 * verifica os indicadores verde (atendido) / vermelho (pendente), a barra de
 * força e a validação de confirmação — os mesmos em todas as telas de senha.
 */
import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { ForcaSenha } from "@/components/app/ForcaSenha";
import { CamposSenha } from "@/components/app/CamposSenha";

afterEach(cleanup);

/** Retorna os itens da lista de critérios marcados como atendidos/pendentes. */
function criterios() {
  const grupo = screen.getByRole("group", { name: /requisitos e força da senha/i });
  return within(grupo)
    .getAllByRole("listitem")
    .map((li) => ({
      texto: li.textContent ?? "",
      atendido: /— atendido/.test(li.textContent ?? ""),
      classe: li.className,
    }));
}

describe("ForcaSenha — indicadores verdes e vermelhos", () => {
  it("com senha vazia, todos os critérios ficam pendentes", () => {
    render(<ForcaSenha senha="" />);
    const itens = criterios();
    expect(itens).toHaveLength(6);
    expect(itens.every((i) => !i.atendido)).toBe(true);
    expect(itens.every((i) => i.classe.includes("text-muted-foreground"))).toBe(true);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "Senha vazia");
  });

  it("com senha completa, todos ficam verdes", () => {
    render(<ForcaSenha senha="Abcd1234!" />);
    const itens = criterios();
    expect(itens.every((i) => i.atendido)).toBe(true);
    expect(itens.every((i) => i.classe.includes("text-success"))).toBe(true);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "6");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toContain("Senha forte");
  });

  it("marca apenas os critérios já atendidos", () => {
    render(<ForcaSenha senha="abcdefgh" />);
    const mapa = Object.fromEntries(criterios().map((i) => [i.texto.split(" —")[0], i.atendido]));
    expect(mapa["Pelo menos 8 caracteres"]).toBe(true);
    expect(mapa["Uma letra minúscula (a-z)"]).toBe(true);
    expect(mapa["Sem espaços em branco"]).toBe(true);
    expect(mapa["Uma letra maiúscula (A-Z)"]).toBe(false);
    expect(mapa["Um número (0-9)"]).toBe(false);
    expect(mapa["Um símbolo (ex.: ! @ # $ % & *)"]).toBe(false);
  });

  it("espaço na senha derruba o indicador correspondente", () => {
    render(<ForcaSenha senha="Abcd 123!" />);
    const espaco = criterios().find((i) => i.texto.includes("Sem espaços"));
    expect(espaco?.atendido).toBe(false);
    expect(espaco?.classe).toContain("text-muted-foreground");
  });

  it("progride de fraca para forte conforme os critérios são atendidos", () => {
    const { rerender } = render(<ForcaSenha senha="abcdefgh" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
    rerender(<ForcaSenha senha="Abcdefg1" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "5");
    rerender(<ForcaSenha senha="Abcdefg1!" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "6");
  });

  it("o grupo de critérios é alcançável pelo teclado", () => {
    render(<ForcaSenha senha="Abc" />);
    expect(screen.getByRole("group", { name: /requisitos e força da senha/i })).toHaveAttribute("tabindex", "0");
  });
});

function Formulario() {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  return (
    <CamposSenha
      senha={senha}
      onSenhaChange={setSenha}
      confirmacao={confirmacao}
      onConfirmacaoChange={setConfirmacao}
      idSenha="teste"
    />
  );
}

describe("CamposSenha — digitação real", () => {
  it("os indicadores ficam verdes conforme o usuário digita", async () => {
    const user = userEvent.setup();
    render(<Formulario />);
    const campo = screen.getByLabelText("Senha");

    await user.type(campo, "abc");
    expect(criterios().filter((i) => i.atendido).map((i) => i.texto.split(" —")[0])).toEqual([
      "Uma letra minúscula (a-z)",
      "Sem espaços em branco",
    ]);

    await user.clear(campo);
    await user.type(campo, "Abcd1234!");
    expect(criterios().every((i) => i.atendido)).toBe(true);
  });

  it("avisa quando a confirmação diverge e some quando confere", async () => {
    const user = userEvent.setup();
    render(<Formulario />);
    await user.type(screen.getByLabelText("Senha"), "Abcd1234!");
    const confirmar = screen.getByLabelText("Confirmar senha");

    await user.type(confirmar, "Abcd1234");
    expect(screen.getByRole("alert")).toHaveTextContent("As senhas não conferem.");
    expect(confirmar).toHaveAttribute("aria-invalid", "true");

    await user.type(confirmar, "!");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("o campo de senha está descrito pelo medidor (acessibilidade)", () => {
    render(<Formulario />);
    expect(screen.getByLabelText("Senha")).toHaveAttribute("aria-describedby", "teste-forca");
    expect(document.getElementById("teste-forca")).not.toBeNull();
  });
});
