import { describe, expect, it } from "vitest";

import {
  avaliarAcessoSimulacao,
  contextoDoApp,
  filtrarSimulacoesVisiveis,
  podeCriarSimulacao,
  type ContextoAcesso,
} from "@/lib/acesso-simulacao";

const ORG_A = "11111111-1111-1111-1111-111111111111";
const ORG_B = "22222222-2222-2222-2222-222222222222";
const AUTOR = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const COLEGA = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const simA = { organizationId: ORG_A, createdBy: AUTOR };

function ctx(p: Partial<ContextoAcesso> = {}): ContextoAcesso {
  return {
    userId: AUTOR,
    contaAtiva: true,
    superAdmin: false,
    vinculos: [{ organizationId: ORG_A, papel: "user" }],
    ...p,
  };
}

describe("contextoDoApp", () => {
  it("converte o estado do provedor em contexto de acesso", () => {
    expect(
      contextoDoApp({
        userId: AUTOR,
        accountStatus: "active",
        isSuperAdmin: false,
        memberships: [{ organization_id: ORG_A, role: "manager" }],
      }),
    ).toEqual({
      userId: AUTOR,
      contaAtiva: true,
      superAdmin: false,
      vinculos: [{ organizationId: ORG_A, papel: "manager" }],
    });
  });

  it("marca conta como inativa quando o status não é active", () => {
    const c = contextoDoApp({
      userId: AUTOR,
      accountStatus: "suspended",
      isSuperAdmin: true,
      memberships: [],
    });
    expect(c.contaAtiva).toBe(false);
  });
});

describe("avaliarAcessoSimulacao", () => {
  it("permite ao autor ler e escrever", () => {
    expect(avaliarAcessoSimulacao(ctx(), simA)).toEqual({
      podeLer: true,
      podeEscrever: true,
      codigo: null,
      motivo: null,
    });
  });

  it("bloqueia colega comum da mesma empresa", () => {
    const r = avaliarAcessoSimulacao(ctx({ userId: COLEGA }), simA);
    expect(r.podeLer).toBe(false);
    expect(r.podeEscrever).toBe(false);
    expect(r.motivo).toBeTruthy();
  });

  it("permite gestor da mesma empresa", () => {
    const r = avaliarAcessoSimulacao(
      ctx({ userId: COLEGA, vinculos: [{ organizationId: ORG_A, papel: "manager" }] }),
      simA,
    );
    expect(r.podeEscrever).toBe(true);
  });

  it("bloqueia gestor de outra empresa", () => {
    const r = avaliarAcessoSimulacao(
      ctx({ userId: COLEGA, vinculos: [{ organizationId: ORG_B, papel: "manager" }] }),
      simA,
    );
    expect(r.podeLer).toBe(false);
  });

  it("permite Administrador Geral mesmo sem vínculo", () => {
    const r = avaliarAcessoSimulacao(ctx({ userId: COLEGA, superAdmin: true, vinculos: [] }), simA);
    expect(r.podeEscrever).toBe(true);
  });

  it("bloqueia conta suspensa, mesmo sendo autor", () => {
    const r = avaliarAcessoSimulacao(ctx({ contaAtiva: false }), simA);
    expect(r.podeLer).toBe(false);
    expect(r.codigo).toBe("conta_inativa");
  });

  it("bloqueia sessão sem usuário", () => {
    const r = avaliarAcessoSimulacao(ctx({ userId: null }), simA);
    expect(r.podeLer).toBe(false);
    expect(r.codigo).toBe("sessao_expirada");
  });

  it("bloqueia quando a simulação não existe ou não retornou (id adivinhado)", () => {
    const r = avaliarAcessoSimulacao(ctx(), null);
    expect(r.podeLer).toBe(false);
    expect(r.podeEscrever).toBe(false);
  });

  it("bloqueia simulação sem autor para membro comum", () => {
    const r = avaliarAcessoSimulacao(ctx(), { organizationId: ORG_A, createdBy: null });
    expect(r.podeLer).toBe(false);
  });
});

describe("podeCriarSimulacao", () => {
  it("exige empresa selecionada", () => {
    expect(podeCriarSimulacao(ctx(), null)).toBe(false);
  });

  it("permite membro ativo da empresa", () => {
    expect(podeCriarSimulacao(ctx(), ORG_A)).toBe(true);
  });

  it("bloqueia empresa sem vínculo", () => {
    expect(podeCriarSimulacao(ctx(), ORG_B)).toBe(false);
  });

  it("permite Administrador Geral em qualquer empresa", () => {
    expect(podeCriarSimulacao(ctx({ superAdmin: true, vinculos: [] }), ORG_B)).toBe(true);
  });
});

describe("filtrarSimulacoesVisiveis", () => {
  it("remove registros de outras empresas ou de outros autores", () => {
    const lista = [
      { id: "1", organizationId: ORG_A, createdBy: AUTOR },
      { id: "2", organizationId: ORG_A, createdBy: COLEGA },
      { id: "3", organizationId: ORG_B, createdBy: AUTOR },
    ];
    expect(filtrarSimulacoesVisiveis(ctx(), lista).map((s) => s.id)).toEqual(["1"]);
  });

  it("gestor enxerga todas as simulações da própria empresa", () => {
    const lista = [
      { id: "1", organizationId: ORG_A, createdBy: AUTOR },
      { id: "2", organizationId: ORG_A, createdBy: COLEGA },
      { id: "3", organizationId: ORG_B, createdBy: COLEGA },
    ];
    const gestor = ctx({ userId: COLEGA, vinculos: [{ organizationId: ORG_A, papel: "manager" }] });
    expect(filtrarSimulacoesVisiveis(gestor, lista).map((s) => s.id)).toEqual(["1", "2"]);
  });
});
