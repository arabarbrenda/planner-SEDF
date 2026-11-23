import { LogOut, ShieldCheck } from "lucide-react";
import { AuthPage } from "./auth/AuthPage";
import { RecoveryPage } from "./auth/RecoveryPage";
import { useAuth } from "./auth/AuthProvider";
import { StudyHome } from "./features/StudyHome";
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

  return <><StudyHome email={user.email ?? "Conta Planner da Bre"}/><button className="floating-signout" onClick={signOut} aria-label="Sair da conta"><LogOut size={17}/><span>Sair</span></button></>;
}