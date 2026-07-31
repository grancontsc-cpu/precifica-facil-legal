import { describe, expect, it } from "vitest";
import { segundosDeEspera } from "./email-diagnostico.server";

describe("cooldown de reenvio", () => {
  it("lê a espera pedida pelo servidor", () => {
    expect(segundosDeEspera("For security purposes, you can only request this after 47 seconds.")).toBe(47);
    expect(segundosDeEspera("Email rate limit exceeded")).toBeNull();
    expect(segundosDeEspera(undefined)).toBeNull();
  });
});
