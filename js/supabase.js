/* =========================================================
   Atelier Noura
   File: js/supabase.js
========================================================= */

window.SUPABASE_CONFIG = {
    url: "https://rjhdfzwsmsijpwfqglxn.supabase.co",
    anonKey: "sb_publishable_Xlg_hV8utl8IXbkWWW_eMw_jW7Nmmmz"
};

window.supabaseClient = null;

function isSupabaseConfigured() {
    return Boolean(
        window.SUPABASE_CONFIG &&
        window.SUPABASE_CONFIG.url &&
        window.SUPABASE_CONFIG.anonKey &&
        !window.SUPABASE_CONFIG.url.includes("YOUR_") &&
        !window.SUPABASE_CONFIG.anonKey.includes("YOUR_")
    );
}

function initSupabase() {
    if (!isSupabaseConfigured()) {
        throw new Error("Supabase configuration is missing.");
    }

    if (!window.supabase || !window.supabase.createClient) {
        throw new Error("Supabase JS library is not loaded.");
    }

    if (!window.supabaseClient) {
        window.supabaseClient =
            window.supabase.createClient(
                window.SUPABASE_CONFIG.url,
                window.SUPABASE_CONFIG.anonKey,
                {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true
                    }
                }
            );
    }

    return window.supabaseClient;
}
