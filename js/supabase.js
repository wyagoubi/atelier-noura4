/* Atelier Noura - Supabase browser configuration */
window.SUPABASE_CONFIG = {
  url: "https://rjhdfzwsmsijpwfqglxn.supabase.co",
  anonKey: "sb_publishable_Xlg_hV8utl8IXbkWWW_eMw_jW7Nmmmz"
};

function isSupabaseConfigured() {
  return Boolean(
    window.SUPABASE_CONFIG?.url &&
    window.SUPABASE_CONFIG?.anonKey
  );
}

async function initSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase غير مضبوط.");
  }

  if (!window.supabase?.createClient) {
    throw new Error("لم يتم تحميل Supabase.");
  }

  if (!window.__ATELIER_NOURA_SUPABASE__) {
    window.__ATELIER_NOURA_SUPABASE__ = window.supabase.createClient(
      window.SUPABASE_CONFIG.url,
      window.SUPABASE_CONFIG.anonKey
    );
  }

  return window.__ATELIER_NOURA_SUPABASE__;
}
