// @vitest-environment jsdom
/**
 * Testes de ponta a ponta (interface) do bloqueio de acesso por URL.
 *
 * Simulam a abertura de /simulador?simulacao=<id> com ids de simulações de
 * outras empresas, de outros usuários e inexistentes, e verificam que a UI:
 *  - não carrega o formulário nem os dados do registro;
 *  - mostra a mensagem padronizada e genérica de indisponibilidade;
 *  - não executa nenhuma escrita (update/insert) no banco;
 *  - registra a tentativa negada na trilha de segurança.
 */
import type React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, act } from "@testing-library/react";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------- mocks

// o chunk do componente da rota é carregado sob demanda; dá folga na 1ª renderização
vi.setConfig({ testTimeout: 120000 });

const buscaSimulacao = vi.fn();
const escritas: { tabela: string; operacao: string }[] = [];

vi.mock("@/integrations/supabase/client", () => {
  function builder(tabela: string) {
    const alvo: Record<string, unknown> = {};
    const chain: Record<string, unknown> = new Proxy(alvo, {
      get(_t, prop: string) {
        if (prop === "then") return undefined;
        if (prop === "maybeSingle" || prop === "single") {
          return async () =>
            tabela === "simulations"
              ? { data: buscaSimulacao(), error: null }
              : { data: null, error: null };
        }
        if (prop === "insert" || prop === "update" || prop === "upsert" || prop === "delete") {
          return (...args: unknown[]) => {
            escritas.push({ tabela, operacao: prop });
            void args;
            return chain;
          };
        }
        if (prop === "select" && tabela !== "simulations") {
          return () => chain;
        }
        return () => chain;
      },
    });
    // listas (perfis/produtos) resolvem vazio quando aguardadas
    (alvo as { order?: unknown }).order = async () => ({ data: [], error: null });
    return chain;
  }
  return { supabase: { from: (tabela: string) => builder(tabela) } };
});

const registrarNegativa = vi.fn();
vi.mock("@/lib/registro-seguranca", () => ({ registrarNegativa: (e: unknown) => registrarNegativa(e) }));

const navigate = vi.fn();
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createFileRoute: () => (opts: Record<string, unknown>) => ({ ...opts, useSearch: () => buscaSearch() }),
    useNavigate: () => navigate,
  };
});

let buscaSearch: () => { simulacao?: string; produto?: string } = () => ({});

const appState = {
  orgId: "org-a" as string | null,
  setOrgId: vi.fn(),
  canEdit: true,
  userId: "user-1" as string | null,
  email: "user@empresa.com",
  nome: "Usuária",
  organizations: [{ id: "org-a", name: "Empresa A", cnpj: null, defaults: null, default_tax_profile_id: null }],
  memberships: [{ organization_id: "org-a", role: "manager" as "manager" | "user" }],
  isSuperAdmin: false,
  isGrancontAdmin: false,
  accountStatus: "active" as string | null,
  loading: false,
};
vi.mock("@/hooks/useApp", () => ({ useApp: () => appState }));

// ------------------------------------------------------------- helpers

/** Pré-carrega o chunk do componente da rota (code splitting do router). */
async function preCarregarComponente() {
  try {
    await import("@/routes/_authenticated/simulador.tsx?tsr-split=component");
  } catch {
    /* sem splitting neste ambiente: o componente já vem no módulo */
  }
}

async function abrirSimulador(simulacaoId?: string) {
  buscaSearch = () => ({ simulacao: simulacaoId, produto: undefined });
  await preCarregarComponente();
  const { Route } = await import("@/routes/_authenticated/simulador");
  const Componente = (Route as unknown as { component: () => React.ReactElement }).component;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <Suspense fallback={<div>carregando</div>}>
        <Componente />
      </Suspense>
    </QueryClientProvider>,
  );
  // o componente da rota é carregado sob demanda (code splitting do router):
  // avança o loop de eventos dentro de act() até o Suspense resolver.
  for (let i = 0; i < 200 && screen.queryByText("carregando"); i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }
  expect(screen.queryByText("carregando")).toBeNull();
}

const simulacaoDe = (organization_id: string, created_by: string | null) => ({
  id: "sim-1",
  organization_id,
  created_by,
  titulo: "Precificação confidencial da Empresa B",
  tax_profile_id: null,
  product_id: null,
  input_snapshot: null,
});

beforeEach(() => {
  escritas.length = 0;
  registrarNegativa.mockClear();
  buscaSimulacao.mockReset();
  appState.orgId = "org-a";
  appState.userId = "user-1";
  appState.isSuperAdmin = false;
  appState.accountStatus = "active";
  appState.memberships = [{ organization_id: "org-a", role: "manager" }];
  localStorage.clear();
});

afterEach(() => cleanup());

// --------------------------------------------------------------- testes

describe("URL com simulação de outra empresa", () => {
  it("bloqueia a carga e mostra a mensagem padronizada", async () => {
    buscaSimulacao.mockReturnValue(simulacaoDe("org-b", "user-9"));
    await abrirSimulador("sim-1");

    await screen.findByText("Simulação indisponível");
    expect(screen.getByText(/não tem permissão para acessar esta simulação/i)).toBeTruthy();
  });

  it("não exibe nenhum dado do registro (título, empresa ou autor)", async () => {
    buscaSimulacao.mockReturnValue(simulacaoDe("org-b", "user-9"));
    await abrirSimulador("sim-1");
    await screen.findByText("Simulação indisponível");

    const texto = document.body.textContent ?? "";
    expect(texto).not.toContain("Precificação confidencial");
    expect(texto).not.toContain("org-b");
    expect(texto).not.toContain("user-9");
    expect(texto).not.toContain("sim-1");
  });

  it("não renderiza o formulário nem o botão de salvar", async () => {
    buscaSimulacao.mockReturnValue(simulacaoDe("org-b", "user-9"));
    await abrirSimulador("sim-1");
    await screen.findByText("Simulação indisponível");

    expect(screen.queryByText(/Formação do preço/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /salvar/i })).toBeNull();
  });

  it("não dispara nenhuma escrita no banco", async () => {
    buscaSimulacao.mockReturnValue(simulacaoDe("org-b", "user-9"));
    await abrirSimulador("sim-1");
    await screen.findByText("Simulação indisponível");

    expect(escritas.filter((e) => e.operacao !== "select")).toHaveLength(0);
  });

  it("registra a tentativa negada de carregamento", async () => {
    buscaSimulacao.mockReturnValue(simulacaoDe("org-b", "user-9"));
    await abrirSimulador("sim-1");
    await screen.findByText("Simulação indisponível");

    await waitFor(() => expect(registrarNegativa).toHaveBeenCalled());
    expect(registrarNegativa.mock.calls[0][0]).toMatchObject({
      acao: "carregar",
      simulacaoId: "sim-1",
      origem: "simulador",
    });
  });
});

describe("URL adivinhada de simulação inexistente", () => {
  it("responde igual ao caso sem permissão, sem revelar que o registro não existe", async () => {
    buscaSimulacao.mockReturnValue(null);
    await abrirSimulador("id-chutado");

    await screen.findByText("Simulação indisponível");
    const texto = document.body.textContent ?? "";
    expect(texto).not.toMatch(/não existe|não encontrad/i);
    expect(screen.getByText(/não tem permissão para acessar esta simulação/i)).toBeTruthy();
  });
});

describe("URL com simulação de outro usuário na mesma empresa", () => {
  it("permite ao gestor da empresa abrir a simulação", async () => {
    buscaSimulacao.mockReturnValue(simulacaoDe("org-a", "user-9"));
    await abrirSimulador("sim-1");

    await waitFor(() => expect(screen.queryByText("Simulação indisponível")).toBeNull());
    expect(registrarNegativa).not.toHaveBeenCalled();
  });

  it("bloqueia o usuário comum que não é autor", async () => {
    appState.memberships = [{ organization_id: "org-a", role: "user" }];
    appState.canEdit = false;
    buscaSimulacao.mockReturnValue(simulacaoDe("org-a", "user-9"));
    await abrirSimulador("sim-1");

    await screen.findByText("Simulação indisponível");
    expect(escritas.filter((e) => e.operacao !== "select")).toHaveLength(0);
    appState.canEdit = true;
  });

  it("permite ao usuário comum abrir a própria simulação", async () => {
    appState.memberships = [{ organization_id: "org-a", role: "user" }];
    buscaSimulacao.mockReturnValue(simulacaoDe("org-a", "user-1"));
    await abrirSimulador("sim-1");

    await waitFor(() => expect(screen.queryByText("Simulação indisponível")).toBeNull());
  });
});

describe("conta suspensa e sessão ausente", () => {
  it("bloqueia conta não ativa mesmo na própria empresa", async () => {
    appState.accountStatus = "suspended";
    buscaSimulacao.mockReturnValue(simulacaoDe("org-a", "user-1"));
    await abrirSimulador("sim-1");

    await screen.findByText("Conta sem acesso");
    expect(escritas.filter((e) => e.operacao !== "select")).toHaveLength(0);
  });
});

describe("Administrador Geral", () => {
  it("abre simulação de qualquer empresa", async () => {
    appState.isSuperAdmin = true;
    appState.memberships = [];
    buscaSimulacao.mockReturnValue(simulacaoDe("org-b", "user-9"));
    await abrirSimulador("sim-1");

    await waitFor(() => expect(screen.queryByText("Simulação indisponível")).toBeNull());
  });
});
