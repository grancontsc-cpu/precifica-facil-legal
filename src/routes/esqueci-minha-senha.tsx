import { createFileRoute, redirect } from "@tanstack/react-router";

/** Rota legada mantida por compatibilidade: encaminha para /recuperar-senha. */
export const Route = createFileRoute("/esqueci-minha-senha")({
  beforeLoad: () => {
    throw redirect({ to: "/recuperar-senha", replace: true });
  },
});
