import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/perfis-tributarios")({
  beforeLoad: () => {
    throw redirect({ to: "/perfis" });
  },
  component: () => null,
});
