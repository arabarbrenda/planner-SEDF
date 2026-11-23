/**
 * Inicialização do cliente Supabase.
 * Este arquivo apenas estabelece a conexão; operações de dados e autenticação
 * só serão habilitadas após a criação do schema e das políticas RLS.
 */
(function () {
  const config = window.PLANNER_SUPABASE_CONFIG;

  function setStatus(status, detail) {
    window.PLANNER_SUPABASE_STATUS = { status, detail: detail || null };
    window.dispatchEvent(new CustomEvent("planner:supabase-status", {
      detail: window.PLANNER_SUPABASE_STATUS
    }));
  }

  if (!config || !config.url || !config.publishableKey) {
    setStatus("not_configured", "Configuração pública do Supabase ausente.");
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    setStatus("sdk_unavailable", "Biblioteca Supabase JS não carregada.");
    return;
  }

  try {
    window.plannerSupabase = window.supabase.createClient(
      config.url,
      config.publishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
    setStatus("initialized", "Cliente Supabase inicializado; schema ainda não configurado.");
  } catch (error) {
    console.error("Falha ao inicializar Supabase:", error);
    setStatus("initialization_error", "Não foi possível inicializar o cliente Supabase.");
  }
})();
