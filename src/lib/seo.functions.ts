import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Status atual do sitemap no Google Search Console (somente Administrador Geral). */
export const statusSitemap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const acesso = await import("./access.server");
    const seo = await import("./seo.server");
    const ator = await acesso.carregarAtor(context.supabase, context.userId);
    acesso.exigirSuperAdmin(ator);

    return seo.consultarStatus();
  });

/** Reenvia o sitemap imediatamente ao Google (somente Administrador Geral). */
export const reenviarSitemap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const acesso = await import("./access.server");
    const seo = await import("./seo.server");
    const ator = await acesso.carregarAtor(context.supabase, context.userId);
    acesso.exigirSuperAdmin(ator);

    return seo.submeterSitemap();
  });
