import { createFileRoute, redirect } from "@tanstack/react-router";

/** Namespace /app/*: encaminha para a rota equivalente do aplicativo (ex.: /app/simulador → /simulador). */
export const Route = createFileRoute("/app/$")({
  beforeLoad: ({ params }) => {
    const destino = `/${(params._splat ?? "").replace(/^\/+/, "")}`;
    throw redirect({ to: destino || "/simulador", replace: true });
  },
});
