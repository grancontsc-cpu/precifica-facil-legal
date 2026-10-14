import type {
  MarcoTemporal,
  ModeloSimples,
  OperacaoFiscal,
  PurchaseTax,
  PurchaseTaxId,
  Regime,
  SaleTax,
  SaleTaxId,
  ScenarioId,
  SimulationState,
} from "@/types/pricing";

const baseTax = (
  id: PurchaseTaxId,
  label: string,
  descricao: string,
  overrides: Partial<PurchaseTax> = {},
): PurchaseTax => ({
  id,
  label,
  descricao,
  enabled: false,
  rate: 0,
  baseMode: "padrao",
  baseManual: 0,
  baseReduction: 0,
  useManualTax: false,
  manualTaxValue: 0,
  treatment: "incluido",
  creditMode: "nao",
  creditPercent: 0,
  creditManual: 0,
  note: "",
  ...overrides,
});

export function tributosCompraPadrao(): PurchaseTax[] {
  return [
    baseTax(
      "icms",
      "ICMS",
      "Imposto estadual sobre circulação de mercadorias. Costuma vir destacado dentro do valor da nota.",
      { enabled: true, rate: 0, treatment: "incluido", creditMode: "integral" },
    ),
    baseTax("pis", "PIS", "Contribuição federal sobre a receita. Pode ou não gerar crédito.", {
      enabled: true,
      rate: 0,
      treatment: "incluido",
      creditMode: "nao",
    }),
    baseTax(
      "cofins",
      "Cofins",
      "Contribuição federal sobre a receita. Pode ou não gerar crédito.",
      {
        enabled: true,
        rate: 0,
        treatment: "incluido",
        creditMode: "nao",
      },
    ),
    baseTax(
      "ipi",
      "IPI",
      "Imposto federal sobre produtos industrializados, normalmente cobrado por fora da mercadoria.",
      {
        enabled: false,
        treatment: "porFora",
        creditMode: "nao",
      },
    ),
    baseTax(
      "ibs",
      "IBS",
      "Imposto sobre Bens e Serviços (reforma tributária). Configure conforme orientação da contabilidade.",
      {
        enabled: false,
        treatment: "informativo",
        creditMode: "nao",
      },
    ),
    baseTax(
      "cbs",
      "CBS",
      "Contribuição sobre Bens e Serviços (reforma tributária). Configure conforme orientação da contabilidade.",
      {
        enabled: false,
        treatment: "informativo",
        creditMode: "nao",
      },
    ),
    baseTax(
      "icmsSt",
      "ICMS-ST / antecipação",
      "Substituição tributária ou antecipação cobrada do comprador. Normalmente é custo e não gera crédito.",
      { enabled: false, treatment: "porFora", creditMode: "nao" },
    ),
    baseTax(
      "outroCompra",
      "Outro tributo ou custo",
      "Use para qualquer outro tributo ou encargo da compra.",
      {
        enabled: false,
        treatment: "porFora",
        creditMode: "nao",
      },
    ),
  ];
}

const saleTax = (
  id: SaleTaxId,
  label: string,
  descricao: string,
  overrides: Partial<SaleTax> = {},
): SaleTax => ({
  id,
  label,
  descricao,
  enabled: false,
  rate: 0,
  baseMode: "padrao",
  baseManual: 0,
  treatment: "incluido",
  ...overrides,
});

export function tributosVendaPadrao(): SaleTax[] {
  return [
    saleTax("icmsVenda", "ICMS", "ICMS devido na venda, geralmente embutido no preço.", {
      enabled: true,
      rate: 0,
      treatment: "incluido",
    }),
    saleTax("pisVenda", "PIS", "PIS devido sobre a receita da venda.", { enabled: true, rate: 0 }),
    saleTax("cofinsVenda", "Cofins", "Cofins devida sobre a receita da venda.", {
      enabled: true,
      rate: 0,
    }),
    saleTax("ipiVenda", "IPI", "IPI da venda, quando aplicável. Normalmente cobrado por fora.", {
      enabled: false,
      treatment: "porFora",
    }),
    saleTax("ibsVenda", "IBS", "IBS da venda (reforma tributária).", {
      enabled: false,
      treatment: "informativo",
    }),
    saleTax("cbsVenda", "CBS", "CBS da venda (reforma tributária).", {
      enabled: false,
      treatment: "informativo",
    }),
    saleTax(
      "seletivoVenda",
      "Imposto Seletivo",
      "Aplicável apenas a produtos específicos previstos em lei.",
      {
        enabled: false,
        treatment: "porFora",
      },
    ),
    saleTax(
      "dasVenda",
      "DAS — Simples Nacional",
      "Tributo único do Simples sobre a receita. Use a alíquota efetiva da sua apuração.",
      { enabled: false, treatment: "incluido" },
    ),
    saleTax("outroVenda", "Outro tributo", "Qualquer outro tributo ou encargo sobre a venda.", {
      enabled: false,
      treatment: "incluido",
    }),
  ];
}

/* ------------------------------------------------------------------ */
/* Contexto fiscal (regime + UFs)                                      */
/* ------------------------------------------------------------------ */

export function operacaoPadrao(overrides: Partial<OperacaoFiscal> = {}): OperacaoFiscal {
  return {
    regime: "real",
    ufOrigem: "",
    ufDestino: "",
    finalidade: "revenda",
    importada: false,
    difalAtivo: true,
    aliquotaInternaDestino: null,
    aliquotaInterestadual: null,
    difalManual: null,
    creditarDifal: null,
    aliquotaSimples: 0,
    ...overrides,
  };
}

/** Garante que simulações salvas antes desta versão tenham contexto fiscal. */
export function garantirOperacao(state: SimulationState): SimulationState {
  if (state.operacao) return state;
  return { ...state, operacao: operacaoPadrao() };
}

/**
 * Ajusta os padrões de crédito e de tributos de venda conforme o regime.
 * São sugestões: o usuário continua podendo alterar qualquer campo.
 */
export function aplicarRegime(state: SimulationState, regime: Regime): SimulationState {
  const semCredito = regime === "simples" || regime === "mei";
  const cumulativo = regime === "presumido";

  const tributosCompra = state.tributosCompra.map((t) => {
    if (t.id === "icms") {
      return { ...t, creditMode: semCredito ? ("nao" as const) : ("integral" as const) };
    }
    if (t.id === "pis" || t.id === "cofins") {
      return {
        ...t,
        creditMode: semCredito || cumulativo ? ("nao" as const) : ("integral" as const),
      };
    }
    if (t.id === "ipi") {
      return { ...t, creditMode: semCredito ? ("nao" as const) : t.creditMode };
    }
    return t;
  });

  const tributosVenda = state.tributosVenda.map((t) => {
    if (t.id === "dasVenda") return { ...t, enabled: semCredito };
    if (["icmsVenda", "pisVenda", "cofinsVenda"].includes(t.id)) {
      return { ...t, enabled: semCredito ? false : t.enabled };
    }
    return t;
  });

  return ajustarCreditosReforma({
    ...state,
    tributosCompra,
    tributosVenda,
    operacao: { ...operacaoPadrao(), ...(state.operacao ?? {}), regime },
  });
}

export function estadoInicial(): SimulationState {
  return {
    produto: {
      nome: "",

      sku: "",
      ncm: "",
      unidade: "unidade",
      quantidade: 1,
      valorUnitario: 0,
      descontoTotal: 0,
      freteTotal: 0,
      seguroTotal: 0,
      outrasDespesas: 0,
      embalagemPorUnidade: 0,
      rateioPorUnidade: 0,
    },
    cenario: "atual",
    tributosCompra: tributosCompraPadrao(),
    venda: {
      modo: "margem",
      margemDesejada: 20,
      precoInformado: 0,
      comissaoPercent: 0,
      cartaoPercent: 0,
      marketplacePercent: 0,
      perdasPercent: 0,
      outrosPercent: 0,
      freteVendaUnidade: 0,
      embalagemVendaUnidade: 0,
      custoFixoUnidade: 0,
      outrasDespesasFixasUnidade: 0,
      baseMargem: "precoFinal",
    },
    tributosVenda: tributosVendaPadrao(),
    modoAvancado: false,
    operacao: operacaoPadrao(),
  };
}

/** Simulação de exemplo com dados realistas de um comércio varejista. */
export function estadoExemplo(): SimulationState {
  const s = estadoInicial();
  s.produto = {
    nome: "Café torrado e moído 500g",
    sku: "CAF-500",
    ncm: "0901.21.00",
    unidade: "fardo",
    quantidade: 120,
    valorUnitario: 18.9,
    descontoTotal: 90,
    freteTotal: 180,
    seguroTotal: 0,
    outrasDespesas: 0,
    embalagemPorUnidade: 0,
    rateioPorUnidade: 0,
  };
  s.cenario = "atual";
  s.operacao = operacaoPadrao({
    regime: "real",
    ufOrigem: "SP",
    ufDestino: "SP",
    aliquotaInternaDestino: 18,
    aliquotaInterestadual: null,
  });
  s.tributosCompra = tributosCompraPadrao().map((t) => {
    if (t.id === "icms")
      return {
        ...t,
        enabled: true,
        rate: 18,
        treatment: "incluido" as const,
        creditMode: "integral" as const,
      };
    if (t.id === "pis")
      return {
        ...t,
        enabled: true,
        rate: 1.65,
        treatment: "incluido" as const,
        creditMode: "integral" as const,
      };
    if (t.id === "cofins")
      return {
        ...t,
        enabled: true,
        rate: 7.6,
        treatment: "incluido" as const,
        creditMode: "integral" as const,
      };
    return t;
  });
  s.tributosVenda = tributosVendaPadrao().map((t) => {
    if (t.id === "icmsVenda") return { ...t, enabled: true, rate: 18 };
    if (t.id === "pisVenda") return { ...t, enabled: true, rate: 1.65 };
    if (t.id === "cofinsVenda") return { ...t, enabled: true, rate: 7.6 };
    return t;
  });
  s.venda = {
    ...s.venda,
    margemDesejada: 15,
    comissaoPercent: 3,
    cartaoPercent: 2.5,
    freteVendaUnidade: 0.8,
    embalagemVendaUnidade: 0.3,
  };
  return s;
}

/** Perfil demonstrativo "Transição 2026 — teste" (valores apenas informativos). */
export function aplicarCenario(state: SimulationState, cenario: ScenarioId): SimulationState {
  const compra = state.tributosCompra.map((t) => ({ ...t }));
  const venda = state.tributosVenda.map((t) => ({ ...t }));

  const set = (id: string, patch: Partial<PurchaseTax>) => {
    const t = compra.find((x) => x.id === id);
    if (t) Object.assign(t, patch);
  };
  const setV = (id: string, patch: Partial<SaleTax>) => {
    const t = venda.find((x) => x.id === id);
    if (t) Object.assign(t, patch);
  };

  switch (cenario) {
    case "atual":
      set("icms", { enabled: true });
      set("pis", { enabled: true });
      set("cofins", { enabled: true });
      set("ibs", { enabled: false });
      set("cbs", { enabled: false });
      setV("icmsVenda", { enabled: true });
      setV("pisVenda", { enabled: true });
      setV("cofinsVenda", { enabled: true });
      setV("ibsVenda", { enabled: false });
      setV("cbsVenda", { enabled: false });
      break;
    case "transicao":
      set("icms", { enabled: true });
      set("pis", { enabled: true });
      set("cofins", { enabled: true });
      set("ibs", { enabled: true });
      set("cbs", { enabled: true });
      setV("icmsVenda", { enabled: true });
      setV("pisVenda", { enabled: true });
      setV("cofinsVenda", { enabled: true });
      setV("ibsVenda", { enabled: true });
      setV("cbsVenda", { enabled: true });
      break;
    case "transicao2026":
      set("icms", { enabled: true });
      set("pis", { enabled: true });
      set("cofins", { enabled: true });
      set("ibs", { enabled: true, rate: 0.1, treatment: "informativo", creditMode: "nao" });
      set("cbs", { enabled: true, rate: 0.9, treatment: "informativo", creditMode: "nao" });
      setV("icmsVenda", { enabled: true });
      setV("pisVenda", { enabled: true });
      setV("cofinsVenda", { enabled: true });
      setV("ibsVenda", { enabled: true, rate: 0.1, treatment: "informativo" });
      setV("cbsVenda", { enabled: true, rate: 0.9, treatment: "informativo" });
      break;
    case "novo":
      set("icms", { enabled: false });
      set("pis", { enabled: false });
      set("cofins", { enabled: false });
      set("ibs", { enabled: true, treatment: "incluido" });
      set("cbs", { enabled: true, treatment: "incluido" });
      setV("icmsVenda", { enabled: false });
      setV("pisVenda", { enabled: false });
      setV("cofinsVenda", { enabled: false });
      setV("ibsVenda", { enabled: true, treatment: "incluido" });
      setV("cbsVenda", { enabled: true, treatment: "incluido" });
      break;
    case "vigencia2027": {
      const r = ALIQUOTAS_REFORMA_PADRAO.vigencia2027;
      set("icms", { enabled: true });
      set("pis", { enabled: false });
      set("cofins", { enabled: false });
      set("ibs", { enabled: true, rate: r.ibs, treatment: "porFora", note: r.notaIbs });
      set("cbs", { enabled: true, rate: r.cbs, treatment: "porFora" });
      setV("icmsVenda", { enabled: true });
      setV("pisVenda", { enabled: false });
      setV("cofinsVenda", { enabled: false });
      setV("ibsVenda", { enabled: true, rate: r.ibs, treatment: "porFora" });
      setV("cbsVenda", { enabled: true, rate: r.cbs, treatment: "porFora" });
      break;
    }
    case "personalizado":
    default:
      break;
  }

  return { ...state, cenario, tributosCompra: compra, tributosVenda: venda };
}

export const CENARIOS: Array<{ id: ScenarioId; nome: string; descricao: string }> = [
  { id: "atual", nome: "Sistema atual", descricao: "ICMS, PIS e Cofins" },
  { id: "transicao", nome: "Transição", descricao: "Sistema atual + IBS e CBS" },
  {
    id: "transicao2026",
    nome: "Transição 2026 — teste",
    descricao: "IBS 0,10% e CBS 0,90% informativos",
  },
  {
    id: "vigencia2027",
    nome: "Vigência 2027",
    descricao: "CBS plena + IBS 0,10%; PIS e Cofins extintos",
  },
  { id: "novo", nome: "Novo sistema", descricao: "IBS e CBS" },
  { id: "personalizado", nome: "Personalizado", descricao: "Você define cada tributo" },
];

/* ------------------------------------------------------------------ */
/* Reforma Tributária — marcos temporais                               */
/* ------------------------------------------------------------------ */

/**
 * Alíquotas de referência sugeridas por marco. São apenas pontos de partida:
 * o usuário pode editar qualquer alíquota nos cards de tributos.
 */
export const ALIQUOTAS_REFORMA_PADRAO = {
  transicao2026: { cbs: 0.9, ibs: 0.1 },
  vigencia2027: { cbs: 8.8, ibs: 0.1, notaIbs: "0,05% estadual + 0,05% municipal" },
  definitivo2033: { cbs: 8.8, ibs: 17.7 },
} as const;

export const MARCOS_TEMPORAIS: Array<{ id: MarcoTemporal; nome: string; descricao: string }> = [
  { id: "atual", nome: "Atual", descricao: "PIS/Cofins + ICMS" },
  { id: "transicao2026", nome: "2026", descricao: "Ano teste — CBS 0,9% e IBS 0,1% informativos" },
  {
    id: "vigencia2027",
    nome: "2027",
    descricao: "CBS plena + IBS 0,1% + extinção de PIS/Cofins",
  },
  { id: "definitivo2033", nome: "2033", descricao: "IBS + CBS plenos, sem ICMS" },
];

export const MODELOS_SIMPLES: Array<{ id: ModeloSimples; nome: string; descricao: string }> = [
  {
    id: "puro",
    nome: "Simples Nacional Puro",
    descricao: "Recolhimento unificado no DAS",
  },
  {
    id: "hibrido",
    nome: "Simples Nacional Híbrido",
    descricao: "Opção pelo IBS/CBS no regime regular, por fora, com direito a crédito",
  },
];

/** IBS/CBS cobrados por fora e creditáveis (a partir de 2027)? */
export function reformaPorFora(marco: MarcoTemporal | undefined): boolean {
  return marco === "vigencia2027" || marco === "definitivo2033";
}

/**
 * Quem se credita do IBS/CBS da compra: Lucro Real, Lucro Presumido (a CBS é
 * não cumulativa para todos) e o Simples Híbrido. Simples Puro e MEI, não.
 * Fornecedor do Simples Puro destaca IBS/CBS dentro do DAS: por padrão o
 * crédito fica desligado e o usuário informa o valor manual, se houver.
 */
export function creditaIbsCbs(op: OperacaoFiscal): boolean {
  if (!reformaPorFora(op.marcoTemporal)) return false;
  if (op.regimeFornecedor === "simplesPuro") return false;
  if (op.regime === "mei") return false;
  if (op.regime === "simples") return op.modeloSimples === "hibrido";
  return true;
}

/** Aplica o marco temporal da reforma: liga/desliga tributos e sugere alíquotas. */
export function aplicarMarcoTemporal(
  state: SimulationState,
  marco: MarcoTemporal,
): SimulationState {
  const op: OperacaoFiscal = {
    ...operacaoPadrao(),
    ...(state.operacao ?? {}),
    marcoTemporal: marco,
  };
  const cenario: ScenarioId =
    marco === "atual"
      ? "atual"
      : marco === "transicao2026"
        ? "transicao2026"
        : marco === "vigencia2027"
          ? "vigencia2027"
          : "novo";
  let s = aplicarCenario({ ...state, operacao: op }, cenario);
  if (marco === "definitivo2033") {
    const r = ALIQUOTAS_REFORMA_PADRAO.definitivo2033;
    s = {
      ...s,
      tributosCompra: s.tributosCompra.map((t) =>
        t.id === "ibs" || t.id === "cbs"
          ? { ...t, rate: t.id === "ibs" ? r.ibs : r.cbs, treatment: "porFora" as const }
          : t.id === "icmsSt"
            ? { ...t, enabled: false }
            : t,
      ),
      tributosVenda: s.tributosVenda.map((t) =>
        t.id === "ibsVenda" || t.id === "cbsVenda"
          ? {
              ...t,
              rate: t.id === "ibsVenda" ? r.ibs : r.cbs,
              treatment: "porFora" as const,
            }
          : t,
      ),
      operacao: { ...op, difalAtivo: false },
    };
  }
  return ajustarCreditosReforma(s);
}

/** Ajusta o direito a crédito de IBS/CBS da compra conforme regime e fornecedor. */
export function ajustarCreditosReforma(state: SimulationState): SimulationState {
  const op = state.operacao;
  if (!op || !reformaPorFora(op.marcoTemporal)) return state;
  const credita = creditaIbsCbs(op);
  return {
    ...state,
    tributosCompra: state.tributosCompra.map((t) =>
      t.id === "ibs" || t.id === "cbs"
        ? { ...t, creditMode: credita ? ("integral" as const) : ("nao" as const) }
        : t,
    ),
  };
}
