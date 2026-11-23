import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthPage } from "../src/auth/AuthPage";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signInWithOAuth: vi.fn()
}));

vi.mock("../src/lib/supabase", () => ({
  requireSupabase: () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      signInWithOAuth: mocks.signInWithOAuth
    }
  })
}));

describe("AuthPage", () => {
  beforeEach(() => {
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    mocks.signInWithOAuth.mockResolvedValue({ error: null });
  });

  it("submits email and password for login", async () => {
    render(<AuthPage />);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "brenda@example.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "brenda@example.com",
      password: "password123"
    }));
  });

  it("shows the email confirmation message after signup without a session", async () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: /Criar minha conta/ }));

    expect(await screen.findByRole("status")).toHaveTextContent("Confira seu e-mail");
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "password123",
      options: { emailRedirectTo: window.location.origin }
    });
  });

  it("sends a neutral password-reset response", async () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByRole("button", { name: "Esqueci minha senha" }));
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "brenda@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar instruções" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Se houver uma conta");
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("brenda@example.com", {
      redirectTo: window.location.origin
    });
  });

  it("reports authentication errors accessibly", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: new Error("Credenciais inválidas") });
    render(<AuthPage />);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "brenda@example.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciais inválidas");
  });

  it("starts Google OAuth with the current app origin", async () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByRole("button", { name: /Continuar com Google/ }));

    await waitFor(() => expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: window.location.origin }
    }));
  });
});
