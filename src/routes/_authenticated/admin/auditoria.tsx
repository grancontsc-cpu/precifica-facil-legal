import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/auditoria")({
  beforeLoad: () => {
    throw redirect({ to: "/auditoria" });
  },
  component: () => null,
});
