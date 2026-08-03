import { afterAll, describe, expect, it } from "vitest";

import {
  CONTRATO_POLITICAS,
  TABELAS_DETALHE,
  podeAcessarSimulacao,
  podeNaLinhaDeDetalhe,
  podeNaSimulacao,
  type ContextoAcesso,
  type Simulacao,
} from "./rls-simulacoes";

const ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const AUTOR = "11111111-1111-1111-1111-111111111111";
const COLEGA = "22222222-2222-2222-2222-222222222222";
const GESTOR = "33333333-3333-3333-3333-333333333333";
const ADMIN = "44444444-4444-4444-4444-444444444444";
const ESTRANHO = "55555555-5555-5555-5555-555555555555";

const simulacao: Simulacao = { organizationId: ORG_A, createdBy: AUTOR };

const ctx = (over: Partial<ContextoAcesso>): ContextoAcesso => ({
  userId: null,
  contaAtiva: true,
  superAdmin: false,
  vinculos: [],
  ...over,
});

const anonimo = ctx({ userId: null, contaAtiva: false });
const autor = ctx({ userId: AUTOR, vinculos: [{ organizationId: ORG_A, papel: "user" }] });
const colega = ctx({ userId: COLEGA, vinculos: [{ organizationId: ORG_A, papel: "user" }] });
const gestor = ctx({ userId: GESTOR, vinculos: [{ organizationId: ORG_A, papel: "manager" }] });
const gestorOutraEmpresa = ctx({
  userId: GESTOR,
  vinculos: [{ organizationId: ORG_B, papel: "manager" }],
});
const adminGeral = ctx({ userId: ADMIN, superAdmin: true });
const estranho = ctx({ userId: ESTRANHO, vinculos: [{ organizationId: ORG_B, papel: "user" }] });
const autorSuspenso = ctx({
  userId: AUTOR,
  contaAtiva: false,
  vinculos: [{ organizationId: ORG_A, papel: "user" }],
});
const adminSuspenso = ctx({ userId: ADMIN, superAdmin: true, contaAtiva: false });

const ACOES = ["SELECT", "UPDATE", "DELETE"] as const;

describe("RLS · acesso à simulação (can_access_simulation)", () => {
  it("permite o autor membro ativo da empresa", () => {
    expect(podeAcessarSimulacao(autor, simulacao)).toBe(true);
  });

  it("permite o gestor da mesma empresa mesmo sem ser o autor", () => {
    expect(podeAcessarSimulacao(gestor, simulacao)).toBe(true);
  });

  it("permite o Administrador Geral", () => {
    expect(podeAcessarSimulacao(adminGeral, simulacao)).toBe(true);
  });

  it("bloqueia colega comum da mesma empresa que não criou a simulação", () => {
    expect(podeAcessarSimulacao(colega, simulacao)).toBe(false);
  });

  it("bloqueia gestor de outra empresa (isolamento multiempresa)", () => {
    expect(podeAcessarSimulacao(gestorOutraEmpresa, simulacao)).toBe(false);
  });

  it("bloqueia usuário de outra empresa", () => {
    expect(podeAcessarSimulacao(estranho, simulacao)).toBe(false);
  });

  it("bloqueia usuário anônimo", () => {
    expect(podeAcessarSimulacao(anonimo, simulacao)).toBe(false);
  });

  it("bloqueia autor com conta suspensa", () => {
    expect(podeAcessarSimulacao(autorSuspenso, simulacao)).toBe(false);
  });

  it("bloqueia Administrador Geral com conta suspensa", () => {
    expect(podeAcessarSimulacao(adminSuspenso, simulacao)).toBe(false);
  });

  it("bloqueia quando a simulação não tem autor e o usuário é membro comum", () => {
    expect(podeAcessarSimulacao(autor, { organizationId: ORG_A, createdBy: null })).toBe(false);
  });
});

describe("RLS · tabela simulations", () => {
  it.each(ACOES)("%s segue exatamente a regra de acesso da simulação", (acao) => {
    expect(podeNaSimulacao(autor, simulacao, acao)).toBe(true);
    expect(podeNaSimulacao(gestor, simulacao, acao)).toBe(true);
    expect(podeNaSimulacao(adminGeral, simulacao, acao)).toBe(true);
    expect(podeNaSimulacao(colega, simulacao, acao)).toBe(false);
    expect(podeNaSimulacao(estranho, simulacao, acao)).toBe(false);
    expect(podeNaSimulacao(anonimo, simulacao, acao)).toBe(false);
    expect(podeNaSimulacao(autorSuspenso, simulacao, acao)).toBe(false);
  });

  it("INSERT exige created_by igual ao usuário autenticado", () => {
    expect(podeNaSimulacao(autor, { organizationId: ORG_A, createdBy: AUTOR }, "INSERT")).toBe(
      true,
    );
    expect(podeNaSimulacao(autor, { organizationId: ORG_A, createdBy: COLEGA }, "INSERT")).toBe(
      false,
    );
    expect(podeNaSimulacao(autor, { organizationId: ORG_A, createdBy: null }, "INSERT")).toBe(
      false,
    );
  });

  it("INSERT bloqueia criação em empresa da qual o usuário não participa", () => {
    expect(podeNaSimulacao(autor, { organizationId: ORG_B, createdBy: AUTOR }, "INSERT")).toBe(
      false,
    );
  });

  it("UPDATE não permite mover a simulação para outra empresa do próprio usuário", () => {
    const alvo: Simulacao = { organizationId: ORG_B, createdBy: AUTOR };
    // WITH CHECK é avaliado sobre a linha resultante: sem vínculo em ORG_B, nega.
    expect(podeNaSimulacao(autor, alvo, "UPDATE")).toBe(false);
  });
});

describe("RLS · linhas de detalhe da simulação", () => {
  it.each(TABELAS_DETALHE)("%s: leitura e escrita seguem can_read/can_write", (tabela) => {
    expect(tabela).toBeTruthy();
    for (const acao of ["SELECT", "INSERT", "UPDATE", "DELETE"] as const) {
      expect(podeNaLinhaDeDetalhe(autor, simulacao, acao)).toBe(true);
      expect(podeNaLinhaDeDetalhe(gestor, simulacao, acao)).toBe(true);
      expect(podeNaLinhaDeDetalhe(adminGeral, simulacao, acao)).toBe(true);
      expect(podeNaLinhaDeDetalhe(colega, simulacao, acao)).toBe(false);
      expect(podeNaLinhaDeDetalhe(estranho, simulacao, acao)).toBe(false);
      expect(podeNaLinhaDeDetalhe(gestorOutraEmpresa, simulacao, acao)).toBe(false);
      expect(podeNaLinhaDeDetalhe(anonimo, simulacao, acao)).toBe(false);
      expect(podeNaLinhaDeDetalhe(autorSuspenso, simulacao, acao)).toBe(false);
    }
  });

  it("UPDATE existe como caminho controlado (não pode ser omitido)", () => {
    for (const tabela of TABELAS_DETALHE) {
      const update = CONTRATO_POLITICAS[tabela].find((p) => p.acao === "UPDATE");
      expect(update?.using).toBe("can_write_simulation(simulation_id)");
      expect(update?.check).toBe("can_write_simulation(simulation_id)");
    }
  });
});

// ---------------------------------------------------------------------------
// Regressão contra o banco real: só roda quando há credenciais de leitura.
// ---------------------------------------------------------------------------

const urlBanco = process.env.SUPABASE_DB_URL;
const TABELAS = ["simulations", ...TABELAS_DETALHE] as const;

type Cliente = {
  query: (sql: string) => Promise<{ rows: Record<string, unknown>[] }>;
  end: () => Promise<void>;
};
let cliente: Cliente | null = null;

async function conectar(): Promise<Cliente> {
  if (cliente) return cliente;
  const { default: pg } = await import("pg");
  const c = new pg.Client({ connectionString: urlBanco, ssl: { rejectUnauthorized: false } });
  await c.connect();
  cliente = c as unknown as Cliente;
  return cliente;
}

afterAll(async () => {
  if (cliente) await cliente.end();
});

describe.skipIf(!urlBanco)("RLS · contrato aplicado no banco", () => {
  it("mantém RLS ativa nas tabelas de simulação", async () => {
    const db = await conectar();
    const { rows } = await db.query(
      `select relname, relrowsecurity from pg_class
        where oid in (${TABELAS.map((t) => `'public.${t}'::regclass`).join(",")})`,
    );
    expect(rows).toHaveLength(TABELAS.length);
    for (const row of rows) expect(row.relrowsecurity, String(row.relname)).toBe(true);
  });

  it("mantém as políticas esperadas para cada ação", async () => {
    const db = await conectar();
    const { rows } = await db.query(
      `select tablename, cmd, qual, with_check from pg_policies
        where schemaname='public' and tablename in (${TABELAS.map((t) => `'${t}'`).join(",")})`,
    );

    for (const [tabela, esperado] of Object.entries(CONTRATO_POLITICAS)) {
      for (const regra of esperado) {
        const encontradas = rows.filter((r) => r.tablename === tabela && r.cmd === regra.acao);
        expect(encontradas.length, `${tabela} ${regra.acao}`).toBeGreaterThan(0);
        const bate = encontradas.some(
          (r) => (r.qual ?? null) === regra.using && (r.with_check ?? null) === regra.check,
        );
        expect(bate, `${tabela} ${regra.acao}: ${JSON.stringify(encontradas)}`).toBe(true);
      }
    }
  });

  it("não expõe nenhuma política para usuários anônimos", async () => {
    const db = await conectar();
    const { rows } = await db.query(
      `select tablename, policyname, roles::text as roles from pg_policies
        where schemaname='public' and tablename in (${TABELAS.map((t) => `'${t}'`).join(",")})
          and (roles::text like '%anon%' or roles::text = '{public}')`,
    );
    expect(rows).toEqual([]);
  });

  it("concede ao papel autenticado os privilégios usados pelo app, e nada ao anônimo", async () => {
    const db = await conectar();
    for (const tabela of TABELAS) {
      const { rows } = await db.query(
        `select
           has_table_privilege('authenticated','public.${tabela}','SELECT') s,
           has_table_privilege('authenticated','public.${tabela}','INSERT') i,
           has_table_privilege('authenticated','public.${tabela}','UPDATE') u,
           has_table_privilege('authenticated','public.${tabela}','DELETE') d,
           has_table_privilege('anon','public.${tabela}','SELECT') anon_s,
           has_table_privilege('anon','public.${tabela}','UPDATE') anon_u`,
      );
      const g = rows[0];
      expect([tabela, g.s, g.i, g.u, g.d]).toEqual([tabela, true, true, true, true]);
      expect([tabela, g.anon_s, g.anon_u]).toEqual([tabela, false, false]);
    }
  });

  it("mantém can_access_simulation restrita a empresa/autoria", async () => {
    const db = await conectar();
    const { rows } = await db.query(
      `select prosrc, prosecdef, proconfig::text as cfg from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname='public' and p.proname='can_access_simulation'`,
    );
    expect(rows).toHaveLength(1);
    const fonte = String(rows[0].prosrc);
    expect(rows[0].prosecdef).toBe(true);
    expect(String(rows[0].cfg)).toContain("search_path=public");
    expect(fonte).toContain("s.organization_id");
    expect(fonte).toContain("s.created_by = auth.uid()");
    expect(fonte).toContain("is_org_member");
    expect(fonte).toContain("is_org_admin");
  });

  it("mantém can_read_simulation e can_write_simulation delegando a can_access_simulation", async () => {
    const db = await conectar();
    const { rows } = await db.query(
      `select proname, prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname='public' and p.proname in ('can_read_simulation','can_write_simulation')`,
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(String(row.prosrc), String(row.proname)).toContain("can_access_simulation(_sim)");
    }
  });
});
