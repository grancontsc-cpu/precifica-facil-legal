import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export type OrgRole = "org_admin" | "viewer";

export interface Membership {
  organization_id: string;
  role: OrgRole;
  organizations: { id: string; name: string; cnpj: string | null; defaults: unknown; default_tax_profile_id: string | null } | null;
}

interface AppContextValue {
  session: Session | null;
  userId: string | null;
  email: string | null;
  isGrancontAdmin: boolean;
  memberships: Membership[];
  organizations: { id: string; name: string; cnpj: string | null; defaults: unknown; default_tax_profile_id: string | null }[];
  orgId: string | null;
  setOrgId: (id: string) => void;
  /** Papel efetivo do usuário na organização selecionada. */
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

  const rolesQuery = useQuery({
    queryKey: ["me", "roles", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId!);
      if (error) throw error;
      return data.map((r) => r.role as string);
    },
  });

  const isGrancontAdmin = (rolesQuery.data ?? []).includes("grancont_admin");

  const membershipsQuery = useQuery({
    queryKey: ["me", "memberships", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("organization_id, role, organizations(id, name, cnpj, defaults, default_tax_profile_id)")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []) as unknown as Membership[];
    },
  });

  const orgsQuery = useQuery({
    queryKey: ["organizations", "all", isGrancontAdmin],
    enabled: !!userId && isGrancontAdmin,
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
    if (isGrancontAdmin) return orgsQuery.data ?? [];
    return (membershipsQuery.data ?? [])
      .map((m) => m.organizations)
      .filter((o): o is NonNullable<Membership["organizations"]> => !!o);
  }, [isGrancontAdmin, orgsQuery.data, membershipsQuery.data]);

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

  const canEdit = useMemo(() => {
    if (isGrancontAdmin) return true;
    const m = (membershipsQuery.data ?? []).find((x) => x.organization_id === orgId);
    return m?.role === "org_admin";
  }, [isGrancontAdmin, membershipsQuery.data, orgId]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const value: AppContextValue = {
    session,
    userId,
    email: session?.user?.email ?? null,
    isGrancontAdmin,
    memberships: membershipsQuery.data ?? [],
    organizations,
    orgId,
    setOrgId,
    canEdit,
    loading: rolesQuery.isLoading || membershipsQuery.isLoading,
    signOut,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp precisa estar dentro de AppProvider");
  return ctx;
}
