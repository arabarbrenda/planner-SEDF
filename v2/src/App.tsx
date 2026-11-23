import { LogOut, ShieldCheck } from "lucide-react";
import { AuthPage } from "./auth/AuthPage";
import { RecoveryPage } from "./auth/RecoveryPage";
import { useAuth } from "./auth/AuthProvider";
import { isSupabaseConfigured, requireSupabase } from "./lib/supabase";

export function App() {
  const { user, loading, authEvent } = useAuth();

  if (!isSupabaseConfigured) {
    return <main className="setup-screen"><div className="setup-card"><span className="brand-mark"><ShieldCheck/></span><p className="eyebrow">CONFIGURAÇÃO NECESSÁRIA</p><h1>Estamos preparando seu espaço.</h1><p>Adicione as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY ao arquivo de ambiente local para conectar este projeto.</p><code>v2/.env.local</code></div></main>;
  }

  if (loading) return <main className="setup-screen"><div className="loading-orbit"/><p>Preparando seu espaço...</p></main>;
  if (authEvent === "PASSWORD_RECOVERY" && user) return <RecoveryPage />;
  if (!user) return <AuthPage />;

  async function signOut() {
    const { error } = await requireSupabase().auth.signOut();
    if (error) console.error("Falha ao sair:", error.message);
  }

  return <main className="welcome-screen"><header className="app-topbar"><div className="brand"><span className="brand-mark">✦</span> planner <b>da bre</b><span className="brand-version">V2</span></div><button className="signout-button" onClick={signOut}><LogOut size={16}/> Sair</button></header><section className="welcome-card"><span className="eyebrow">ACESSO CONFIRMADO</span><h1>Bem-vinda à sua nova fase.</h1><p>Você entrou como <b>{user.email}</b>.</p><div className="coming-soon"><ShieldCheck size={19}/> Sua área de estudos está sendo construída com segurança.</div></section></main>;
}