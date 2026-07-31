import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

/** Rota legada mantida por compatibilidade: encaminha para /cadastro. */
export const Route = createFileRoute("/cadastrar")({
  validateSearch: z.object({ email: z.string().optional() }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/cadastro", search, replace: true });
  },
});
