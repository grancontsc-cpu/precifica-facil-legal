// @vitest-environment jsdom
import { it, expect } from "vitest";
it("dbg", async () => {
  const m = await import("@/routes/_authenticated/simulador.tsx?tsr-split=component");
  console.log("keys", Object.keys(m));
  expect(true).toBe(true);
});
