import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/app/AppShell";
import { GuardaStatus } from "@/components/app/GuardaAcesso";
import { AppProvider } from "@/hooks/useApp";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    // Preserva a rota pretendida para voltar a ela depois do login.
    if (error || !data.user) throw redirect({ to: "/login", search: { next: location.href } });
    return { user: data.user };
  },
  component: () => (
    <AppProvider>
      <GuardaStatus>
        <AppShell>
          <Outlet />
        </AppShell>
      </GuardaStatus>
    </AppProvider>
  ),
});
