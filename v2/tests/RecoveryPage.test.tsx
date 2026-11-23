import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RecoveryPage } from "../src/auth/RecoveryPage";

const mocks = vi.hoisted(() => ({ updateUser: vi.fn() }));

vi.mock("../src/lib/supabase", () => ({
  requireSupabase: () => ({ auth: { updateUser: mocks.updateUser } })
}));

describe("RecoveryPage", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    mocks.updateUser.mockResolvedValue({ error: null });
  });

  function fillPasswords(password: string, confirmation: string) {
    render(<RecoveryPage />);
    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: password } });
    fireEvent.change(screen.getByLabelText("Confirme a nova senha"), { target: { value: confirmation } });
    fireEvent.submit(screen.getByRole("button", { name: "Salvar nova senha" }).closest("form")!);
  }

  it("rejects passwords shorter than eight characters", async () => {
    fillPasswords("short", "short");
    expect((await screen.findByRole("alert")).textContent).toContain("pelo menos 8 caracteres");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords", async () => {
    fillPasswords("password123", "different123");
    expect((await screen.findByRole("alert")).textContent).toContain("As senhas não coincidem");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("updates the password and shows confirmation", async () => {
    fillPasswords("password123", "password123");
    expect(await screen.findByText(/Sua senha foi atualizada/)).toBeTruthy();
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "password123" });
  });

  it("shows the update error accessibly", async () => {
    mocks.updateUser.mockResolvedValue({ error: new Error("Falha ao atualizar") });
    fillPasswords("password123", "password123");
    expect((await screen.findByRole("alert")).textContent).toContain("Falha ao atualizar");
  });
});
