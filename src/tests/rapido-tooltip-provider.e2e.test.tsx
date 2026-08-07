// @vitest-environment jsdom
/**
 * Regressão: expandir "Suposições fiscais deste cálculo" no modo rápido
 * renderiza <CampoNumero ajuda="..."> (via SuposicoesFiscais), que usa
 * <Tooltip> internamente. Sem um <TooltipProvider> ancestral, o Radix lança
 * "`Tooltip` must be used within `TooltipProvider`" e o ErrorBoundary da
 * rota raiz derruba a tela inteira ("Não conseguimos abrir esta tela").
 */
import type React from "react";
import { describe, it, vi, beforeAll, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
});

vi.mock("@/integrations/supabase/client", () => {
  const chain: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === "then") return undefined;
        return () => chain;
      },
    },
  );
  return { supabase: { from: () => chain } };
});

vi.mock("@/hooks/useApp", () => ({
  useApp: () => ({ empresa: { id: "org-a", uf: "SP", regime: "real" } }),
}));

const navigate = vi.fn();
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useNavigate: () => navigate,
    Link: (props: React.ComponentProps<"a"> & { to?: string }) => {
      const { to, children, ...rest } = props;
      return (
        <a href={to} {...rest}>
          {children}
        </a>
      );
    },
  };
});

async function abrirRapido() {
  await import("@/routes/_authenticated/rapido");
  const mod = (await import(
    /* @vite-ignore */ "@/routes/_authenticated/rapido.tsx?tsr-split=component" as string
  )) as { component: () => React.ReactElement };
  const Componente = mod.component;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <Componente />
    </QueryClientProvider>,
  );
}

describe("modo rápido — passo 5", () => {
  it("expande as suposições fiscais sem lançar erro de Tooltip sem provider", async () => {
    const user = userEvent.setup();
    await abrirRapido();

    await user.type(screen.getByLabelText("Nome do produto"), "Produto teste");
    await user.click(screen.getByRole("button", { name: /continuar/i }));

    await user.type(screen.getByLabelText("Valor unitário de compra"), "10,50");
    await user.click(screen.getByRole("button", { name: /continuar/i }));

    await user.click(screen.getByLabelText("Estado de origem"));
    await user.click(await screen.findByRole("option", { name: /^SP —/ }));
    await user.click(screen.getByLabelText("Estado de destino"));
    await user.click(await screen.findByRole("option", { name: /^RJ —/ }));
    await user.click(screen.getByRole("button", { name: /continuar/i }));

    await user.click(screen.getByRole("button", { name: /ver preço sugerido/i }));
    await waitFor(() => screen.getByText("Preço de venda sugerido por unidade"));

    // Este clique é o gatilho do bug: monta <CampoNumero ajuda="..."> -> <Tooltip>.
    await user.click(screen.getByText("Suposições fiscais deste cálculo"));

    // A tela de erro genérica não deve aparecer.
    expect(screen.queryByText("Não conseguimos abrir esta tela")).toBeNull();
  }, 20000);
});
