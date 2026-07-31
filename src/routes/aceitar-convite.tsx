import { createFileRoute, redirect } from "@tanstack/react-router";

/** Fluxo sem convites: o cadastro é aberto e autoatendido em /cadastro. */
export const Route = createFileRoute("/aceitar-convite")({
  beforeLoad: () => {
    throw redirect({ to: "/cadastro", replace: true });
  },
});
