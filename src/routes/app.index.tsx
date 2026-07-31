import { createFileRoute, redirect } from "@tanstack/react-router";

/** /app abre o simulador. */
export const Route = createFileRoute("/app/")({
  beforeLoad: () => {
    throw redirect({ to: "/simulador", replace: true });
  },
});
