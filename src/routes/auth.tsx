import { createFileRoute, redirect } from "@tanstack/react-router";

/** Rota antiga mantida apenas para redirecionar links já compartilhados. */
export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/login", search: { next: undefined } });
  },
  component: () => null,
});
