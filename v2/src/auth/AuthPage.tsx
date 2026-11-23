import { useState, type FormEvent } from "react";
import { ArrowRight, BookOpen, Eye, EyeOff, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { requireSupabase } from "../lib/supabase";

type Mode = "login" | "signup" | "reset";

export function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleGoogle() {
    setBusy(true); setError(""); setMessage("");
    try {
      const supabase = requireSupabase();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin }
      });
      if (authError) throw authError;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar o login com Google.");
      setBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const supabase = requireSupabase();
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
      } else if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin }
        });
        if (authError) throw authError;
        if (!data.session) setMessage("Conta criada! Confira seu e-mail para confirmar o endereço antes de entrar.");
      } else {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin
        });
        if (authError) throw authError;
        setMessage("Se houver uma conta para esse e-mail, enviaremos as instruções de recuperação.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir a solicitação.");
    } finally {
      setBusy(false);
    }
  }

  const heading = mode === "login" ? "Que bom ter você de volta." : mode === "signup" ? "Comece sua jornada." : "Vamos recuperar seu acesso.";
  const description = mode === "login" ? "Entre para continuar de onde parou." : mode === "signup" ? "Crie sua conta e organize seus próximos passos." : "Informe seu e-mail para receber o link de recuperação.";

  return (
    <main className="auth-shell">
      <section className="auth-visual">
        <div className="brand"><span className="brand-mark"><BookOpen size={21}/></span><span>planner <b>da bre</b></span><span className="brand-version">V2</span></div>
        <div className="visual-copy">
          <span className="eyebrow"><Sparkles size={14}/> UM ESPAÇO SEU</span>
          <h1>Seu foco.<br/><em>Seu ritmo.</em><br/>Sua conquista.</h1>
          <p>Um lugar para transformar intenção em constância — um dia de cada vez.</p>
        </div>
        <div className="visual-footer"><span>PLANEJAMENTO COM PROPÓSITO</span><span>BRASÍLIA · BRASIL</span></div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="mobile-brand"><span className="brand-mark"><BookOpen size={19}/></span> planner <b>da bre</b></div>
          <div className="auth-heading"><span className="eyebrow">SEU PRÓXIMO CAPÍTULO</span><h2>{heading}</h2><p>{description}</p></div>

          {mode !== "reset" && <button className="google-button" type="button" onClick={handleGoogle} disabled={busy}>
            <span className="google-g">G</span> Continuar com Google
          </button>}

          {mode !== "reset" && <div className="separator"><span>ou use seu e-mail</span></div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <label htmlFor="email">E-mail</label>
            <div className="input-wrap"><Mail size={17}/><input id="email" type="email" autoComplete="email" placeholder="voce@exemplo.com" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
            {mode !== "reset" && <>
              <label htmlFor="password">Senha</label>
              <div className="input-wrap"><LockKeyhole size={17}/><input id="password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Mínimo de 8 caracteres" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required/><button className="icon-button" type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={()=>setShowPassword(v=>!v)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>
            </>}
            {mode === "login" && <button className="text-link forgot" type="button" onClick={()=>{setMode("reset");setMessage("");setError("");}}>Esqueci minha senha</button>}
            <button className="submit-button" type="submit" disabled={busy}>{busy ? "Aguarde..." : mode === "login" ? "Entrar" : mode === "signup" ? "Criar minha conta" : "Enviar instruções"} <ArrowRight size={17}/></button>
          </form>

          {error && <p className="feedback error" role="alert">{error}</p>}
          {message && <p className="feedback success" role="status">{message}</p>}

          <p className="switch-mode">{mode === "login" ? "Ainda não tem uma conta?" : mode === "signup" ? "Já tem uma conta?" : "Lembrou sua senha?"} <button className="text-link" type="button" onClick={()=>{setMode(mode === "reset" ? "login" : mode === "login" ? "signup" : "login");setMessage("");setError("");}}>{mode === "login" ? "Criar conta" : "Voltar para entrar"}</button></p>
          <p className="privacy-note">Ao continuar, você concorda em usar a Planner da Bre de forma responsável e segura.</p>
        </div>
      </section>
    </main>
  );
}