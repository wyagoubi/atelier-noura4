/* ============================================================
   ATELIER NOURA - SUPABASE CONFIGURATION
   Browser-safe publishable key only.
   Never put a secret/service_role key in this file.
============================================================ */

(function () {
  "use strict";

  window.SUPABASE_CONFIG = {
    url: "https://rjhdfzwsmsijpwfqglxn.supabase.co",
    anonKey: "sb_publishable_Xlg_hV8utl8IXbkWWW_eMw_jW7Nmmmz"
  };

  window.isSupabaseConfigured = function () {
    return Boolean(
      window.SUPABASE_CONFIG?.url &&
      window.SUPABASE_CONFIG?.anonKey &&
      window.SUPABASE_CONFIG.anonKey !== "YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY"
    );
  };

  window.initSupabase = async function () {
    if (!window.supabase?.createClient) {
      throw new Error("Supabase library is not loaded.");
    }

    if (!window.isSupabaseConfigured()) {
      throw new Error("Supabase configuration is missing.");
    }

    if (!window.__ATELIER_NOORA_SUPABASE_CLIENT) {
      window.__ATELIER_NOORA_SUPABASE_CLIENT = window.supabase.createClient(
        window.SUPABASE_CONFIG.url,
        window.SUPABASE_CONFIG.anonKey
      );
    }

    return window.__ATELIER_NOORA_SUPABASE_CLIENT;
  };
})();
