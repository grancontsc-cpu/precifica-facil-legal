// @vitest-environment jsdom
/**
 * Navegação por teclado do menu suspenso do cabeçalho:
 * abrir com Enter e com seta para baixo, mover com as setas (com ciclo no fim
 * da lista), selecionar com Enter e fechar com Esc devolvendo o foco ao gatilho.
 */
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Settings, ShieldCheck, Users } from "lucide-react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...resto }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...resto}>
      {children}
    </a>
  ),
}));

import { MenuSuspenso } from "@/components/app/MenuSuspenso";
import type { ItemNav } from "@/components/app/navegacao";

afterEach(cleanup);

const ITENS: ItemNav[] = [
  {
    to: "/gestao/empresas",
    label: "Empresas",
    descricao: "Cadastro de empresas",
    icon: ShieldCheck,
  },
  { to: "/gestao/vinculos", label: "Vínculos", descricao: "Solicitações de acesso", icon: Users },
  { to: "/gestao/licencas", label: "Licenças", descricao: "Planos e assinaturas", icon: Settings },
] as ItemNav[];

function montar() {
  render(<MenuSuspenso rotulo="Gestão" itens={ITENS} pathname="/simulador" />);
  return screen.getByRole("button", { name: /gestão/i });
}

async function itensDoMenu() {
  return await screen.findAllByRole("menuitem");
}

describe("MenuSuspenso — teclado", () => {
  it("abre com Enter e foca o primeiro item", async () => {
    const usuario = userEvent.setup();
    const gatilho = montar();
    gatilho.focus();
    await usuario.keyboard("{Enter}");

    const itens = await itensDoMenu();
    expect(itens).toHaveLength(3);
    await waitFor(() => expect(itens[0]).toHaveFocus());
  });

  it("abre com a seta para baixo", async () => {
    const usuario = userEvent.setup();
    const gatilho = montar();
    gatilho.focus();
    await usuario.keyboard("{ArrowDown}");

    const itens = await itensDoMenu();
    await waitFor(() => expect(itens[0]).toHaveFocus());
  });

  it("percorre os itens com as setas e volta ao primeiro no fim da lista", async () => {
    const usuario = userEvent.setup();
    const gatilho = montar();
    gatilho.focus();
    await usuario.keyboard("{Enter}");
    const itens = await itensDoMenu();
    await waitFor(() => expect(itens[0]).toHaveFocus());

    await usuario.keyboard("{ArrowDown}");
    await waitFor(() => expect(itens[1]).toHaveFocus());
    await usuario.keyboard("{ArrowDown}");
    await waitFor(() => expect(itens[2]).toHaveFocus());
    // ciclo: do último volta ao primeiro
    await usuario.keyboard("{ArrowDown}");
    await waitFor(() => expect(itens[0]).toHaveFocus());
    // e do primeiro sobe para o último
    await usuario.keyboard("{ArrowUp}");
    await waitFor(() => expect(itens[2]).toHaveFocus());
  });

  it("fecha com Esc e devolve o foco ao gatilho", async () => {
    const usuario = userEvent.setup();
    const gatilho = montar();
    gatilho.focus();
    await usuario.keyboard("{Enter}");
    await itensDoMenu();

    await usuario.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menuitem")).not.toBeInTheDocument());
    await waitFor(() => expect(gatilho).toHaveFocus());
  });

  it("seleciona um item com Enter e fecha o menu", async () => {
    const usuario = userEvent.setup();
    const gatilho = montar();
    gatilho.focus();
    await usuario.keyboard("{Enter}");
    const itens = await itensDoMenu();
    await waitFor(() => expect(itens[0]).toHaveFocus());

    await usuario.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(screen.queryByRole("menuitem")).not.toBeInTheDocument());
  });
});

describe("MenuSuspenso — clique fora", () => {
  function montarComFora() {
    render(
      <div>
        <MenuSuspenso rotulo="Gestão" itens={ITENS} pathname="/simulador" />
        <p data-testid="fora">Área fora do menu</p>
      </div>,
    );
    return {
      gatilho: screen.getByRole("button", { name: /gestão/i }),
      fora: screen.getByTestId("fora"),
    };
  }

  it("devolve o foco ao gatilho e atualiza aria-expanded", async () => {
    const usuario = userEvent.setup({ pointerEventsCheck: 0 });
    const { gatilho, fora } = montarComFora();

    expect(gatilho).toHaveAttribute("aria-expanded", "false");
    await usuario.click(gatilho);
    await itensDoMenu();
    expect(gatilho).toHaveAttribute("aria-expanded", "true");

    await usuario.click(fora);
    await waitFor(() => expect(screen.queryByRole("menuitem")).not.toBeInTheDocument());
    await waitFor(() => expect(gatilho).toHaveAttribute("aria-expanded", "false"));
    await waitFor(() => expect(gatilho).toHaveFocus());
  });

  it("permite reabrir pelo teclado logo após o clique fora", async () => {
    const usuario = userEvent.setup({ pointerEventsCheck: 0 });
    const { gatilho, fora } = montarComFora();

    await usuario.click(gatilho);
    await itensDoMenu();
    await usuario.click(fora);
    await waitFor(() => expect(gatilho).toHaveFocus());

    await usuario.keyboard("{ArrowDown}");
    const itens = await itensDoMenu();
    expect(gatilho).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(itens[0]).toHaveFocus());
  });
});

