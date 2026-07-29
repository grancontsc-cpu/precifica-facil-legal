import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/app/AppShell";
import { GuardaStatus } from "@/components/app/GuardaAcesso";
import { AppProvider } from "@/hooks/useApp";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
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
