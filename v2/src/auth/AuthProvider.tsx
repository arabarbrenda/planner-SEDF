import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configured: boolean;
  authEvent: AuthChangeEvent | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authEvent, setAuthEvent] = useState<AuthChangeEvent | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    let alive = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) console.error("Falha ao recuperar sessão:", error.message);
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setAuthEvent(event);
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    loading,
    configured: Boolean(supabase),
    authEvent
  }), [session, loading, authEvent]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth precisa ser usado dentro de AuthProvider.");
  return value;
}