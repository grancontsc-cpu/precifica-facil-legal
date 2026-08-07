// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CalculadoraRateio } from "./CalculadoraRateio";

afterEach(cleanup);

describe("CalculadoraRateio", () => {
  it("calcula e aplica o rateio proporcional ao valor do item", async () => {
    const user = userEvent.setup();
    const onAplicar = vi.fn();

    // Item de R$100 na nota, quantidade 10 (R$10 por unidade).
    render(<CalculadoraRateio valorItemSugerido={100} quantidade={10} onAplicar={onAplicar} />);

    await user.click(screen.getByRole("button", { name: /ratear despesas da nota/i }));

    // Nota de R$1000, frete de R$500: este item (R$100 = 10% da nota) recebe R$50.
    await user.type(screen.getByLabelText("Valor total da nota (soma de todos os itens)"), "1000");
    await user.type(screen.getByLabelText("Frete total da nota"), "500");

    expect(await screen.findByText("R$ 50,00")).toBeInTheDocument();
    // Por unidade: R$50 / 10 unidades = R$5,00.
    expect(screen.getByText(/\(R\$ 5,00\/un\.\)/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /aplicar aos campos/i }));

    expect(onAplicar).toHaveBeenCalledWith({ frete: 50, seguro: 0, outras: 0, desconto: 0 });
  });

  it("reseta os campos da nota ao reabrir, mantendo o valor sugerido do item", async () => {
    const user = userEvent.setup();
    render(<CalculadoraRateio valorItemSugerido={200} quantidade={1} onAplicar={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /ratear despesas da nota/i }));
    await user.type(screen.getByLabelText("Frete total da nota"), "300");
    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    await user.click(screen.getByRole("button", { name: /ratear despesas da nota/i }));
    expect(screen.getByLabelText("Frete total da nota")).toHaveValue("");
    expect(screen.getByLabelText("Valor deste item na nota")).toHaveValue("200");
  });
});
