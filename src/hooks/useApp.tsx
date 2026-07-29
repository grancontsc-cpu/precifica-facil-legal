import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export type OrgRole = "manager" | "user";
export type PapelEfetivo = "super_admin" | "manager" | "user";
export type StatusConta =
  | "invited"
  | "pending_email_verification"
  | "pending_approval"
  | "active"
  | "suspended"
  | "rejected"
  | "archived";

export const NOME_PAPEL: Record<PapelEfetivo, string> = {
  super_admin: "Administrador Geral",
  manager: "Gestor",
  user: "Usuário",
};

export interface Membership {
  organization_id: string;
  role: OrgRole;
  organizations: { id: string; name: string; cnpj: string | null; defaults: unknown; default_tax_profile_id: string | null } | null;
}

interface AppContextValue {
  session: Session | null;
  userId: string | null;
  email: string | null;
  nome: string | null;
  isGrancontAdmin: boolean;
  isSuperAdmin: boolean;
  papel: PapelEfetivo;
  accountStatus: StatusConta | null;
  memberships: Membership[];
  organizations: { id: string; name: string; cnpj: string | null; defaults: unknown; default_tax_profile_id: string | null }[];
  orgId: string | null;
  setOrgId: (id: string) => void;
  /** Pode criar/editar dados da empresa selecionada (gestor ou administrador geral). */
  canEdit: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const ORG_PREF_KEY = "precifica:org-selecionada";

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [orgId, setOrgIdState] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id ?? null;

  const perfilQuery = useQuery({
    queryKey: ["me", "perfil", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [{ data: perfil }, { data: globais }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, account_status").eq("id", userId!).maybeSingle(),
        supabase.from("global_user_roles").select("role").eq("user_id", userId!),
      ]);
      return {
        perfil,
        isSuperAdmin: (globais ?? []).some((g) => g.role === "super_admin"),
      };
    },
  });

  const isSuperAdmin = perfilQuery.data?.isSuperAdmin ?? false;
  const accountStatus = (perfilQuery.data?.perfil?.account_status ?? null) as StatusConta | null;

  const membershipsQuery = useQuery({
    queryKey: ["me", "memberships", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("organization_id, role, organizations(id, name, cnpj, defaults, default_tax_profile_id)")
        .eq("user_id", userId!)
        .eq("membership_status", "active");
      if (error) throw error;
      return (data ?? []) as unknown as Membership[];
    },
  });

  const orgsQuery = useQuery({
    queryKey: ["organizations", "all", isSuperAdmin],
    enabled: !!userId && isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, cnpj, defaults, default_tax_profile_id")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const organizations = useMemo(() => {
    if (isSuperAdmin) return orgsQuery.data ?? [];
    return (membershipsQuery.data ?? [])
      .map((m) => m.organizations)
      .filter((o): o is NonNullable<Membership["organizations"]> => !!o);
  }, [isSuperAdmin, orgsQuery.data, membershipsQuery.data]);

  useEffect(() => {
    if (!organizations.length) return;
    if (orgId && organizations.some((o) => o.id === orgId)) return;
    const preferida = typeof window !== "undefined" ? localStorage.getItem(ORG_PREF_KEY) : null;
    const escolhida = organizations.find((o) => o.id === preferida) ?? organizations[0];
    setOrgIdState(escolhida.id);
  }, [organizations, orgId]);

  const setOrgId = (id: string) => {
    setOrgIdState(id);
    try {
      localStorage.setItem(ORG_PREF_KEY, id);
    } catch {
      /* preferência de interface apenas */
    }
  };

  const papelNaOrg = useMemo(() => {
    const m = (membershipsQuery.data ?? []).find((x) => x.organization_id === orgId);
    return m?.role ?? null;
  }, [membershipsQuery.data, orgId]);

  const papel: PapelEfetivo = isSuperAdmin
    ? "super_admin"
    : (membershipsQuery.data ?? []).some((m) => m.role === "manager")
      ? "manager"
      : "user";

  const canEdit = isSuperAdmin || papelNaOrg === "manager";

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    try {
      localStorage.removeItem(ORG_PREF_KEY);
    } catch {
      /* ignora */
    }
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  const value: AppContextValue = {
    session,
    userId,
    email: session?.user?.email ?? null,
    nome: perfilQuery.data?.perfil?.full_name ?? null,
    isGrancontAdmin: isSuperAdmin,
    isSuperAdmin,
    papel,
    accountStatus,
    memberships: membershipsQuery.data ?? [],
    organizations,
    orgId,
    setOrgId,
    canEdit,
    loading: perfilQuery.isLoading || membershipsQuery.isLoading,
    signOut,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp precisa estar dentro de AppProvider");
  return ctx;
}

/** Destino inicial conforme papel e situação da conta. */
export function destinoInicial(papel: PapelEfetivo, status: StatusConta | null, temVinculo: boolean) {
  if (status === "suspended") return "/acesso-bloqueado";
  if (status === "pending_approval") return "/aguardando-aprovacao";
  if (status === "pending_email_verification" || status === "invited") return "/confirmar-email";
  if (status === "rejected" || status === "archived") return "/acesso-negado";
  if (papel === "super_admin") return "/admin";
  if (!temVinculo) return "/acesso-negado";
  if (papel === "manager") return "/gestao";
  return "/simulador";
}
