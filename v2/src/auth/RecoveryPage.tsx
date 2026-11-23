import { useState, type FormEvent } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { requireSupabase } from "../lib/supabase";

export function RecoveryPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await requireSupabase().auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar sua senha.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="setup-screen"><section className="setup-card">
    <span className="brand-mark"><ShieldCheck/></span>
    <p className="eyebrow">RECUPERAÇÃO DE ACESSO</p>
    <h1>Escolha uma nova senha.</h1>
    {success ? <><p>Sua senha foi atualizada. Você já pode continuar usando sua conta.</p><button className="submit-button" onClick={()=>window.location.assign(window.location.origin)}>Continuar</button></> : <form className="auth-form" onSubmit={handleSubmit}>
      <label htmlFor="new-password">Nova senha</label>
      <div className="input-wrap"><LockKeyhole size={17}/><input id="new-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required/></div>
      <label htmlFor="confirm-password">Confirme a nova senha</label>
      <div className="input-wrap"><LockKeyhole size={17}/><input id="confirm-password" type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={e=>setConfirmation(e.target.value)} required/></div>
      {error && <p className="feedback error" role="alert">{error}</p>}
      <button className="submit-button" type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar nova senha"}</button>
    </form>}
  </section></main>;
}