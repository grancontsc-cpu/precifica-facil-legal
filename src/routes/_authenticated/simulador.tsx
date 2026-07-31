import { useEffect, useMemo, useState } from "react";
import { metaPagina } from "@/lib/seo-head";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, RotateCcw, Save, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CampoNumero, CampoTexto, Ajuda } from "@/components/pricing/CampoNumero";
import { CardTributoCompra } from "@/components/pricing/CardTributoCompra";
import { CardTributoVenda } from "@/components/pricing/CardTributoVenda";
import { PainelResultados } from "@/components/pricing/PainelResultados";
import { EntendaOCalculo } from "@/components/pricing/EntendaOCalculo";
import {
  AlternadorModo,
  DESCRICAO_MODO,
  modoValido,
  type ModoSimulador,
} from "@/components/pricing/AlternadorModo";
import { ContextoFiscal } from "@/components/pricing/ContextoFiscal";
import { useAliquotas } from "@/hooks/useAliquotas";
import { sincronizarOperacao } from "@/lib/aliquotas";
import { ResumoFlutuante } from "@/components/pricing/ResumoFlutuante";
import { simular } from "@/lib/pricing-engine";
import {
  CENARIOS,
  aplicarCenario,
  aplicarRegime,
  estadoExemplo,
  estadoInicial,
  garantirOperacao,
  operacaoPadrao,
} from "@/lib/pricing-defaults";
import { formatBRL, formatData } from "@/lib/format";
import { BarraSimulacao } from "@/components/app/BarraSimulacao";
import { ExportarSimulacao } from "@/components/report/ExportarSimulacao";
import { comparacaoSalva } from "@/lib/comparison-storage";
import { useApp } from "@/hooks/useApp";
import {
  avaliarAcessoSimulacao,
  contextoDoApp,
  podeCriarSimulacao,
  textoAcesso,
} from "@/lib/acesso-simulacao";
import { AvisoAcesso } from "@/components/app/AvisoAcesso";
import { registrarNegativa } from "@/lib/registro-seguranca";
import { supabase } from "@/integrations/supabase/client";
import {
  aplicarPerfil,
  camposAlterados,
  lockedFieldsOf,
  type TaxProfileLineRow,
  type TaxProfileRow,
} from "@/lib/tax-profiles";
import type {
  OperacaoFiscal,
  ProdutoCompra,
  Regime,
  PurchaseTax,
  SaleTax,
  ScenarioId,
  SimulationState,
  VendaConfig,
} from "@/types/pricing";

const TITULO = "Precifica Grancont — simulador de preço de venda";
const DESCRICAO =
  "Calcule custo líquido de aquisição, créditos tributários e preço de venda recomendado com memória de cálculo completa e tributos totalmente configuráveis.";

const ROTULOS_BLOQUEIO: Record<string, string> = {
  tributosCompra: "Tributos da compra",
  tributosVenda: "Tributos da venda",
  despesasVenda: "Despesas de venda",
  margem: "Margem desejada",
};

export const Route = createFileRoute("/_authenticated/simulador")({
  validateSearch: (search: Record<string, unknown>): { simulacao?: string; produto?: string } => ({
    simulacao: typeof search.simulacao === "string" ? search.simulacao : undefined,
    produto: typeof search.produto === "string" ? search.produto : undefined,
  }),
  head: () => ({
    ...metaPagina({
      titulo: TITULO,
      descricao: DESCRICAO,
      caminho: "/simulador",
    }),
  }),
  component: Simulador,
});

const STORAGE_KEY = "precifica-grancont:rascunho";

const UNIDADES = ["unidade", "pacote", "caixa", "fardo", "kg", "litro", "outro"];

const AVISO_RODAPE =
  "Esta ferramenta realiza simulações gerenciais de precificação. O tratamento tributário depende do produto, NCM, CST, CFOP, origem, destino, regime tributário, benefícios fiscais e direito a crédito. Valide as configurações com sua contabilidade.";

function Secao({
  numero,
  titulo,
  descricao,
  children,
  acao,
}: {
  numero: string;
  titulo: string;
  descricao: string;
  children: React.ReactNode;
  acao?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{numero}</p>
          <h2 className="mt-0.5 text-lg font-semibold text-foreground">{titulo}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
        </div>
        {acao ? <div className="shrink-0">{acao}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Simulador() {
  const {
    orgId,
    setOrgId,
    canEdit,
    userId,
    email,
    organizations,
    empresa,

    memberships,
    isSuperAdmin,
    accountStatus,
    loading: carregandoContexto,
  } = useApp();
  const { simulacao: simulacaoId, produto: produtoQuery } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const ctxAcesso = useMemo(
    () => contextoDoApp({ userId, accountStatus, isSuperAdmin, memberships }),
    [userId, accountStatus, isSuperAdmin, memberships],
  );

  const [state, setState] = useState<SimulationState>(() => estadoInicial());
  const [modo, setModo] = useState<ModoSimulador>("simples");
  const [salvoEm, setSalvoEm] = useState<Date | null>(null);
  const [, setCarregado] = useState(false);
  const [titulo, setTitulo] = useState("Nova simulação");
  const [perfilId, setPerfilId] = useState<string | null>(null);
  const [produtoId, setProdutoId] = useState<string | null>(produtoQuery ?? null);
  const [baseline, setBaseline] = useState<SimulationState | null>(null);
  const [simulacaoAtual, setSimulacaoAtual] = useState<string | null>(simulacaoId ?? null);


  const perfisQuery = useQuery({
    queryKey: ["tax_profiles", "simulador", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_profiles")
        .select("*")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as TaxProfileRow[];
    },
  });

  const produtosQuery = useQuery({
    queryKey: ["products", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, nome, sku, valor_unitario")
        .eq("organization_id", orgId!)
        .eq("active", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const perfilSelecionado = (perfisQuery.data ?? []).find((p) => p.id === perfilId) ?? null;



  const aplicarPerfilNoEstado = async (id: string) => {
    if (id === "manual") {
      setPerfilId(null);
      setBaseline(null);
      return;
    }
    const perfil = (perfisQuery.data ?? []).find((p) => p.id === id);
    if (!perfil) return;
    const { data, error } = await supabase.from("tax_profile_lines").select("*").eq("tax_profile_id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setState((s) => {
      const novo = aplicarPerfil(s, perfil, (data ?? []) as unknown as TaxProfileLineRow[]);
      setBaseline(novo);
      return novo;
    });
    setPerfilId(id);
    toast.success(`Perfil "${perfil.name}" aplicado.`);
  };

  const aplicarProduto = (id: string) => {
    if (id === "avulso") {
      setProdutoId(null);
      return;
    }
    const p = (produtosQuery.data ?? []).find((x) => x.id === id);
    if (!p) return;
    setProdutoId(id);
    setState((s) => ({
      ...s,
      produto: { ...s.produto, nome: p.nome, valorUnitario: Number(p.valor_unitario) },
    }));
  };

  // Carrega simulação existente somente se o usuário puder acessá-la.
  const simulacaoQuery = useQuery({
    queryKey: ["simulation", simulacaoId],
    enabled: !!simulacaoId && !!userId && !carregandoContexto,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simulations")
        .select("id, organization_id, created_by, titulo, tax_profile_id, product_id, input_snapshot")
        .eq("id", simulacaoId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const acessoSimulacao = useMemo(() => {
    if (!simulacaoId) return null;
    if (simulacaoQuery.isPending) return null;
    const linha = simulacaoQuery.data;
    return avaliarAcessoSimulacao(
      ctxAcesso,
      linha ? { organizationId: linha.organization_id, createdBy: linha.created_by } : null,
    );
  }, [simulacaoId, simulacaoQuery.isPending, simulacaoQuery.data, ctxAcesso]);

  // Auditoria de segurança: tentativa de abrir simulação sem permissão.
  useEffect(() => {
    if (!simulacaoId || !userId) return;
    if (!acessoSimulacao || acessoSimulacao.podeLer) return;
    registrarNegativa({
      acao: "carregar",
      simulacaoId,
      organizationId: simulacaoQuery.data?.organization_id ?? null,
      motivo: acessoSimulacao.motivo,
      origem: "simulador",
    });
  }, [simulacaoId, userId, acessoSimulacao, simulacaoQuery.data?.organization_id]);


  useEffect(() => {
    const linha = simulacaoQuery.data;
    if (!linha || !acessoSimulacao?.podeLer) return;
    const snapshot = linha.input_snapshot as unknown as SimulationState | null;
    if (snapshot?.produto) setState(snapshot);
    setTitulo(linha.titulo);
    setPerfilId(linha.tax_profile_id);
    setProdutoId(linha.product_id);
    setSimulacaoAtual(linha.id);
    setOrgId(linha.organization_id);
    setCarregado(true);
  }, [simulacaoQuery.data, acessoSimulacao?.podeLer, setOrgId]);

  /**
   * Permissão efetiva de escrita: em simulação existente vale a regra da
   * própria simulação (autor, gestor da empresa dela ou Administrador Geral);
   * em simulação nova vale o vínculo com a empresa selecionada.
   */
  const podeEditarAtual = simulacaoId
    ? Boolean(acessoSimulacao?.podeEscrever)
    : canEdit && podeCriarSimulacao(ctxAcesso, orgId);

  const camposBloqueados = podeEditarAtual
    ? lockedFieldsOf(perfilSelecionado)
    : Object.keys(ROTULOS_BLOQUEIO);
  const bloqueado = (chave: string) => camposBloqueados.includes(chave) || !podeEditarAtual;


  const alterados = baseline ? camposAlterados(baseline, state) : [];

  useEffect(() => {
    if (simulacaoId) return;
    try {
      const bruto = localStorage.getItem(STORAGE_KEY);
      if (bruto) {
        const dados = JSON.parse(bruto) as { state: SimulationState; salvoEm?: string };
        if (dados?.state?.produto) {
          setState(dados.state);
          if (dados.salvoEm) setSalvoEm(new Date(dados.salvoEm));
        }
      }
    } catch {
      // rascunho inválido é simplesmente ignorado
    }
    setCarregado(true);
  }, [simulacaoId]);

  const { tabela } = useAliquotas();
  const resultado = useMemo(() => simular(state), [state]);

  const operacao = state.operacao ?? operacaoPadrao();

  const setOperacao = (patch: Partial<OperacaoFiscal>) =>
    setState((s) => {
      const base = { ...operacaoPadrao(), ...(s.operacao ?? {}), ...patch };
      return { ...s, operacao: sincronizarOperacao(base, tabela) };
    });

  const setRegime = (regime: Regime) =>
    setState((s) => {
      const comRegime = aplicarRegime(garantirOperacao(s), regime);
      return {
        ...comRegime,
        operacao: sincronizarOperacao(comRegime.operacao ?? operacaoPadrao(), tabela),
      };
    });

  // Preenche o contexto fiscal com o cadastro da empresa e as alíquotas vigentes.
  useEffect(() => {
    setState((s) => {
      const atual = { ...operacaoPadrao(), ...(s.operacao ?? {}) };
      const proposta = {
        ...atual,
        ufDestino: atual.ufDestino || (empresa?.uf ?? ""),
        regime: (atual.regime ?? "real") as Regime,
      };
      const sincronizada = sincronizarOperacao(proposta, tabela);
      const igual = JSON.stringify(sincronizada) === JSON.stringify(s.operacao);
      return igual ? s : { ...s, operacao: sincronizada };
    });
  }, [empresa?.uf, tabela]);

  // O regime cadastrado da empresa vale como padrão da primeira simulação.
  useEffect(() => {
    const regimeEmpresa = empresa?.regime as Regime | undefined;
    if (!regimeEmpresa || simulacaoId) return;
    setState((s) =>
      s.operacao?.regime && s.operacao.regime !== "real" ? s : aplicarRegime(garantirOperacao(s), regimeEmpresa),
    );
  }, [empresa?.regime, simulacaoId]);

  const nomeEmpresa =
    organizations?.find((o) => o.id === orgId)?.name ?? "Empresa não selecionada";

  const comparacaoParaRelatorio = useMemo(
    () => comparacaoSalva(state.produto.nome),
    [state.produto.nome],
  );

  const setProduto = (patch: Partial<ProdutoCompra>) =>
    setState((s) => ({ ...s, produto: { ...s.produto, ...patch } }));
  const setVenda = (patch: Partial<VendaConfig>) =>
    setState((s) => ({ ...s, venda: { ...s.venda, ...patch } }));
  const setTributoCompra = (id: string, patch: Partial<PurchaseTax>) =>
    setState((s) => ({
      ...s,
      cenario: "personalizado",
      tributosCompra: s.tributosCompra.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  const setTributoVenda = (id: string, patch: Partial<SaleTax>) =>
    setState((s) => ({
      ...s,
      tributosVenda: s.tributosVenda.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));


  const cenarioAtual = CENARIOS.find((c) => c.id === state.cenario);

  const salvarRascunho = () => {
    const agora = new Date();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, salvoEm: agora.toISOString() }));
    setSalvoEm(agora);
    toast.success("Rascunho salvo neste navegador.");
  };

  const novaSimulacao = () => {
    setState(estadoInicial());
    toast.info("Nova simulação iniciada.");
  };

  const limpar = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState(estadoInicial());
    setSalvoEm(null);
    toast.info("Simulação limpa.");
  };

  const carregarExemplo = () => {
    setState(estadoExemplo());
    toast.info("Valores de exemplo restaurados.");
  };

  const salvarNoBanco = useMutation({
    mutationFn: async ({ duplicar }: { duplicar: boolean }) => {
      if (!orgId) throw new Error("Selecione uma empresa para salvar a simulação.");
      const negar = (motivo: string): never => {
        registrarNegativa({
          acao: duplicar ? "duplicar" : simulacaoAtual ? "salvar" : "criar",
          simulacaoId: simulacaoAtual,
          organizationId: orgId,
          motivo,
          origem: "simulador",
        });
        throw new Error(motivo);
      };
      if (!podeCriarSimulacao(ctxAcesso, orgId)) {
        negar(textoAcesso("sem_permissao_leitura"));
      }
      if (simulacaoAtual && !duplicar && !acessoSimulacao?.podeEscrever) {
        negar(acessoSimulacao?.motivo ?? textoAcesso("somente_leitura"));
      }
      if (!podeEditarAtual) negar(textoAcesso("somente_leitura"));
      if (!titulo.trim()) throw new Error("Informe um nome para a simulação.");
      if (resultado.issues.some((v) => v.severidade === "erro")) {
        throw new Error("Corrija os erros de validação antes de salvar.");
      }


      let snapshotPerfil: unknown = {};
      if (perfilId) {
        const { data: linhas } = await supabase
          .from("tax_profile_lines")
          .select("*")
          .eq("tax_profile_id", perfilId);
        snapshotPerfil = { perfil: perfilSelecionado, linhas: linhas ?? [] };
      }

      const registro = {
        organization_id: orgId,
        titulo: titulo.trim(),
        product_id: produtoId,
        produto_nome: state.produto.nome || null,
        quantidade: Number(state.produto.quantidade) || 1,
        tax_profile_id: perfilId,
        tax_profile_name: perfilSelecionado?.name ?? null,
        tax_profile_version: perfilSelecionado?.version ?? null,
        tax_profile_snapshot: snapshotPerfil as never,
        input_snapshot: state as never,
        result_snapshot: resultado as never,
        overridden_fields: alterados as never,
        custo_liquido_unitario: resultado.compra.custoLiquidoUnitario,
        preco_final: resultado.recomendado?.precoFinal ?? null,
        margem_efetiva: resultado.recomendado?.margemEfetiva ?? null,
        status: "salva" as const,
        calculated_at: new Date().toISOString(),
        created_by: userId,
      };

      if (simulacaoAtual && !duplicar) {
        const { error } = await supabase
          .from("simulations")
          .update(registro)
          .eq("id", simulacaoAtual)
          .eq("organization_id", orgId);
        if (error) throw error;
        return simulacaoAtual;
      }

      const { data, error } = await supabase
        .from("simulations")
        .insert({ ...registro, titulo: duplicar ? `${registro.titulo} (cópia)` : registro.titulo })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id, vars) => {
      setSimulacaoAtual(id);
      qc.invalidateQueries({ queryKey: ["simulations", orgId] });
      toast.success(vars.duplicar ? "Simulação duplicada." : "Simulação salva no histórico.");
      void navigate({ to: "/simulador", search: { simulacao: id, produto: undefined }, replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const compra = resultado.compra;

  // Abriu com ?simulacao=<id>: aguarda a verificação e bloqueia se não houver acesso.
  if (simulacaoId && (carregandoContexto || simulacaoQuery.isPending)) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">Verificando permissões da simulação…</p>
      </main>
    );
  }

  if (simulacaoId && acessoSimulacao && !acessoSimulacao.podeLer) {
    return (
      <AvisoAcesso
        codigo={acessoSimulacao.codigo ?? "sem_permissao_leitura"}
        solicitacao={{ simulacaoId }}

        acoes={[
          {
            rotulo: "Nova simulação",
            variante: "outline",
            onClick: () =>
              void navigate({ to: "/simulador", search: { simulacao: undefined, produto: undefined } }),
          },
          { rotulo: "Ver meu histórico", onClick: () => void navigate({ to: "/simulacoes" }) },
        ]}
      />
    );
  }


  return (

    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-background pb-32 lg:pb-10">
        <header className="border-b border-border bg-card">
          <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                Simulador de preço
              </h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="border-primary/30 text-primary">
                  {cenarioAtual?.nome ?? "Personalizado"}
                </Badge>
                {salvoEm ? <span>Rascunho salvo em {formatData(salvoEm)}</span> : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" className="h-10" onClick={novaSimulacao}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Nova simulação</span>
              </Button>
              <Button size="sm" className="h-10" onClick={salvarRascunho}>
                <Save className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Salvar rascunho</span>
              </Button>
            </div>
          </div>
        </header>


        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="mb-6">
            <BarraSimulacao
              titulo={titulo}
              onTitulo={setTitulo}
              perfis={(perfisQuery.data ?? []).map((p) => ({
                id: p.id,
                rotulo: `${p.name} (v${p.version})`,
              }))}
              perfilId={perfilId}
              onPerfil={(id) => void aplicarPerfilNoEstado(id)}
              produtos={(produtosQuery.data ?? []).map((p) => ({
                id: p.id,
                rotulo: p.sku ? `${p.nome} — ${p.sku}` : p.nome,
              }))}
              produtoId={produtoId}
              onProduto={aplicarProduto}
              camposAlterados={alterados}
              camposBloqueados={camposBloqueados.map((c) => ROTULOS_BLOQUEIO[c] ?? c)}
              podeEditar={podeEditarAtual}
              salvando={salvarNoBanco.isPending}
              simulacaoSalva={!!simulacaoAtual}
              onSalvar={() => salvarNoBanco.mutate({ duplicar: false })}
              onDuplicar={() => salvarNoBanco.mutate({ duplicar: true })}
              acoes={
                <ExportarSimulacao
                  state={state}
                  resultado={resultado}
                  comparacao={comparacaoParaRelatorio}
                  meta={{
                    empresa: nomeEmpresa,
                    produto: state.produto.nome || "Produto avulso",
                    tituloSimulacao: titulo,
                    perfilTributario: perfilSelecionado
                      ? `${perfilSelecionado.name} (v${perfilSelecionado.version})`
                      : "Configuração manual",
                    dataSimulacao: new Date(),
                    emitidoPor: email ?? undefined,
                    camposAlterados: alterados,
                    camposBloqueados: camposBloqueados.map((c) => ROTULOS_BLOQUEIO[c] ?? c),
                  }}
                />
              }
            />
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start">
            <div className="space-y-6">
              <div className="space-y-3 rounded-xl border border-border bg-surface px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlternadorModo
                      modo={modo}
                      onChange={(v) => {
                        setModo(v);
                        setState((s) => ({ ...s, modoAvancado: v === "completo" }));
                      }}
                    />
                    <Ajuda texto="No modo completo você edita base de cálculo, redução de base, percentual de crédito, valores manuais e observações." />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" size="sm" className="h-10" onClick={carregarExemplo}>
                      <Sparkles className="h-4 w-4" aria-hidden />
                      Ver exemplo pronto
                    </Button>
                    <Button variant="ghost" size="sm" className="h-10" onClick={limpar}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                      Limpar simulação
                    </Button>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {DESCRICAO_MODO[modo]}
                </p>
              </div>

              <Secao
                numero="Contexto fiscal"
                titulo="Regime e trajeto da mercadoria"
                descricao="O regime da empresa e os estados de origem e destino definem o ICMS de fronteira e se ele vira crédito ou custo."
              >
                <ContextoFiscal
                  operacao={operacao}
                  onChange={setOperacao}
                  onRegime={setRegime}
                  avancado={modo === "completo"}
                  compacto={modo === "rapido"}
                />
              </Secao>

              {modo === "rapido" ? (
                <>
                  <Secao
                    numero="Seção 1"
                    titulo="Produto e preço"
                    descricao="O essencial para uma estimativa rápida do preço de venda."
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <CampoTexto
                        label="Nome do produto"
                        value={state.produto.nome}
                        onChange={(v) => setProduto({ nome: v })}
                        placeholder="Ex.: Café torrado e moído 500g"
                        className="sm:col-span-2"
                      />
                      <CampoNumero
                        label="Valor unitário de compra"
                        value={state.produto.valorUnitario}
                        onChange={(v) => setProduto({ valorUnitario: v })}
                        prefixo="R$"
                      />
                      <CampoNumero
                        label="Quantidade"
                        value={state.produto.quantidade}
                        onChange={(v) => setProduto({ quantidade: v })}
                      />
                      <CampoNumero
                        label="Margem desejada"
                        value={state.venda.margemDesejada}
                        onChange={(v) => setVenda({ margemDesejada: v })}
                        sufixo="%"
                        className="sm:col-span-2"
                      />
                    </div>
                  </Secao>
                  <Alert>
                    <Info className="size-4" />
                    <AlertDescription>
                      Este é um valor aproximado: o modo rápido usa apenas as alíquotas gerais do
                      trajeto informado. Para precificar com precisão — com créditos, despesas de
                      venda, frete e benefícios fiscais — use o modo Simples ou o modo Completo.
                    </AlertDescription>
                  </Alert>
                </>
              ) : (
                <>
              <Secao

                numero="Seção 1"
                titulo="Produto e compra"
                descricao="Informe o que foi comprado e quanto foi pago ao fornecedor."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <CampoTexto
                    label="Nome do produto"
                    value={state.produto.nome}
                    onChange={(v) => setProduto({ nome: v })}
                    placeholder="Ex.: Café torrado e moído 500g"
                    className="sm:col-span-2"
                  />
                  <CampoTexto
                    label="Código ou SKU (opcional)"
                    value={state.produto.sku}
                    onChange={(v) => setProduto({ sku: v })}
                  />
                  <CampoTexto
                    label="NCM (opcional)"
                    value={state.produto.ncm}
                    onChange={(v) => setProduto({ ncm: v })}
                    ajuda="O preenchimento do NCM não altera automaticamente os tributos nesta versão."
                  />
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Unidade</Label>
                    <Select
                      value={state.produto.unidade}
                      onValueChange={(v) => setProduto({ unidade: v })}
                    >
                      <SelectTrigger className="h-11" aria-label="Unidade de compra">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIDADES.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <CampoNumero
                    label="Quantidade comprada"
                    value={state.produto.quantidade}
                    onChange={(v) => setProduto({ quantidade: v })}
                    ajuda="Aceita até quatro casas decimais."
                  />
                  <CampoNumero
                    label="Valor unitário de compra"
                    prefixo="R$"
                    value={state.produto.valorUnitario}
                    onChange={(v) => setProduto({ valorUnitario: v })}
                  />
                  <CampoNumero
                    label="Desconto incondicional total"
                    prefixo="R$"
                    value={state.produto.descontoTotal}
                    onChange={(v) => setProduto({ descontoTotal: v })}
                    ajuda="Desconto que já vem aplicado na nota, sem condição futura."
                  />
                  <CampoNumero
                    label="Frete de compra total"
                    prefixo="R$"
                    value={state.produto.freteTotal}
                    onChange={(v) => setProduto({ freteTotal: v })}
                  />
                  <CampoNumero
                    label="Seguro total"
                    prefixo="R$"
                    value={state.produto.seguroTotal}
                    onChange={(v) => setProduto({ seguroTotal: v })}
                  />
                  <CampoNumero
                    label="Outras despesas de compra"
                    prefixo="R$"
                    value={state.produto.outrasDespesas}
                    onChange={(v) => setProduto({ outrasDespesas: v })}
                  />
                  <CampoNumero
                    label="Embalagem por unidade (opcional)"
                    prefixo="R$"
                    value={state.produto.embalagemPorUnidade}
                    onChange={(v) => setProduto({ embalagemPorUnidade: v })}
                  />
                  <CampoNumero
                    label="Rateio de outros custos por unidade (opcional)"
                    prefixo="R$"
                    value={state.produto.rateioPorUnidade}
                    onChange={(v) => setProduto({ rateioPorUnidade: v })}
                  />
                </div>

                <dl className="mt-5 grid gap-3 rounded-lg bg-surface p-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">Valor bruto dos produtos</dt>
                    <dd className="text-base font-semibold tabular-nums text-foreground">
                      {formatBRL(compra.valorBrutoProdutos)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Compra antes dos créditos</dt>
                    <dd className="text-base font-semibold tabular-nums text-foreground">
                      {formatBRL(compra.desembolsoTotal)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Valor médio por unidade</dt>
                    <dd className="text-base font-semibold tabular-nums text-foreground">
                      {formatBRL(compra.valorMedioUnitario)}
                    </dd>
                  </div>
                </dl>
              </Secao>

              <Secao
                numero="Seção 2"
                titulo="Cenário tributário"
                descricao="O cenário apenas ativa ou desativa tributos. Todas as alíquotas e tratamentos continuam editáveis."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {CENARIOS.map((c) => {
                    const ativo = state.cenario === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setState((s) => aplicarCenario(s, c.id as ScenarioId))}
                        aria-pressed={ativo}
                        className={`rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          ativo
                            ? "border-primary bg-brand-soft"
                            : "border-border bg-card hover:bg-surface"
                        }`}
                      >
                        <p className="text-sm font-semibold text-foreground">{c.nome}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{c.descricao}</p>
                      </button>
                    );
                  })}
                </div>
                {state.cenario === "transicao2026" ? (
                  <Alert className="mt-4">
                    <Info className="h-4 w-4" aria-hidden />
                    <AlertDescription className="text-sm">
                      Perfil de referência. Confirme o tratamento aplicável com a contabilidade. O
                      IBS (0,10%) e a CBS (0,90%) iniciam como informativos e não alteram custo nem
                      preço até que você mude o tratamento.
                    </AlertDescription>
                  </Alert>
                ) : null}
              </Secao>

              <Secao
                numero="Seção 3"
                titulo="Tributos da compra"
                descricao="Alíquota e direito ao crédito são informações independentes. Configure cada tributo conforme a nota e a orientação da contabilidade."
              >
                <div className="space-y-3">
                  {state.tributosCompra.map((t) => (
                    <CardTributoCompra
                      key={t.id}
                      tributo={t}
                      avancado={state.modoAvancado}
                      resultado={compra.tributos.find((r) => r.id === t.id)}
                      onChange={(patch) => setTributoCompra(t.id, patch)}
                    />
                  ))}
                </div>
              </Secao>

              <Secao
                numero="Seção 4"
                titulo="Venda e margem"
                descricao="Calcule o preço a partir da margem desejada ou analise a margem de um preço já praticado."
              >
                <Tabs
                  value={state.venda.modo}
                  onValueChange={(v) => setVenda({ modo: v as VendaConfig["modo"] })}
                >
                  <TabsList className="w-full">
                    <TabsTrigger value="margem" className="flex-1">
                      Calcular preço pela margem
                    </TabsTrigger>
                    <TabsTrigger value="analise" className="flex-1">
                      Analisar preço informado
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {state.venda.modo === "margem" ? (
                    <CampoNumero
                      label="Margem desejada"
                      sufixo="%"
                      value={state.venda.margemDesejada}
                      onChange={(v) => setVenda({ margemDesejada: v })}
                      ajuda="Margem: percentual que sobra da venda depois do custo do produto, tributos e despesas variáveis."
                    />
                  ) : (
                    <CampoNumero
                      label="Preço de venda informado"
                      prefixo="R$"
                      value={state.venda.precoInformado}
                      onChange={(v) => setVenda({ precoInformado: v })}
                      ajuda="Preço final cobrado do cliente, incluindo tributos acrescentados por fora."
                    />
                  )}
                  <CampoNumero
                    label="Comissão"
                    sufixo="%"
                    value={state.venda.comissaoPercent}
                    onChange={(v) => setVenda({ comissaoPercent: v })}
                  />
                  <CampoNumero
                    label="Taxa de cartão"
                    sufixo="%"
                    value={state.venda.cartaoPercent}
                    onChange={(v) => setVenda({ cartaoPercent: v })}
                  />
                  <CampoNumero
                    label="Taxa de marketplace"
                    sufixo="%"
                    value={state.venda.marketplacePercent}
                    onChange={(v) => setVenda({ marketplacePercent: v })}
                  />
                  <CampoNumero
                    label="Perdas estimadas"
                    sufixo="%"
                    value={state.venda.perdasPercent}
                    onChange={(v) => setVenda({ perdasPercent: v })}
                  />
                  <CampoNumero
                    label="Outros percentuais sobre a venda"
                    sufixo="%"
                    value={state.venda.outrosPercent}
                    onChange={(v) => setVenda({ outrosPercent: v })}
                  />
                  <CampoNumero
                    label="Frete de venda por unidade"
                    prefixo="R$"
                    value={state.venda.freteVendaUnidade}
                    onChange={(v) => setVenda({ freteVendaUnidade: v })}
                  />
                  <CampoNumero
                    label="Embalagem de venda por unidade"
                    prefixo="R$"
                    value={state.venda.embalagemVendaUnidade}
                    onChange={(v) => setVenda({ embalagemVendaUnidade: v })}
                  />
                  <CampoNumero
                    label="Rateio de custo fixo por unidade (opcional)"
                    prefixo="R$"
                    value={state.venda.custoFixoUnidade}
                    onChange={(v) => setVenda({ custoFixoUnidade: v })}
                  />
                  <CampoNumero
                    label="Outras despesas fixas por unidade"
                    prefixo="R$"
                    value={state.venda.outrasDespesasFixasUnidade}
                    onChange={(v) => setVenda({ outrasDespesasFixasUnidade: v })}
                  />
                </div>

                {state.modoAvancado ? (
                  <div className="mt-4 space-y-1.5 rounded-lg bg-surface p-4">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Base da margem
                      </Label>
                      <Ajuda texto="Por padrão a margem é calculada sobre o preço final cobrado. Você pode usar o preço antes dos tributos acrescentados por fora." />
                    </div>
                    <Select
                      value={state.venda.baseMargem}
                      onValueChange={(v) => setVenda({ baseMargem: v as VendaConfig["baseMargem"] })}
                    >
                      <SelectTrigger className="h-11" aria-label="Base da margem">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="precoFinal">Preço final cobrado</SelectItem>
                        <SelectItem value="precoBase">
                          Preço antes dos tributos acrescentados por fora
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <h3 className="mt-6 text-sm font-semibold text-foreground">Tributos da venda</h3>
                <div className="mt-3 space-y-3">
                  {state.tributosVenda.map((t) => (
                    <CardTributoVenda
                      key={t.id}
                      tributo={t}
                      avancado={state.modoAvancado}
                      resultado={resultado.recomendado?.tributos.find((r) => r.id === t.id)}
                      onChange={(patch) => setTributoVenda(t.id, patch)}
                    />
                  ))}
                </div>
              </Secao>
                </>
              )}

              <EntendaOCalculo state={state} resultado={resultado} />


              <footer className="rounded-xl border border-border bg-surface p-4 text-xs leading-relaxed text-muted-foreground">
                {AVISO_RODAPE}
              </footer>
            </div>

            <div className="hidden lg:block">
              <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
                <PainelResultados resultado={resultado} />
              </div>
            </div>

            <div id="resultados" className="lg:hidden">
              <PainelResultados resultado={resultado} />
            </div>
          </div>
        </main>

        <ResumoFlutuante resultado={resultado} />
      </div>
    </TooltipProvider>
  );
}
