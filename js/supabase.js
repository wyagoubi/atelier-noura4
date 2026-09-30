// Supabase public browser configuration.
// ضع هنا فقط URL و anon/publishable key.
// ممنوع وضع service_role key هنا.

window.SUPABASE_CONFIG = {
  url: "https://rjhdfzwsmsijpwfqglxn.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY"
};

window.supabaseClient = null;

function isSupabaseConfigured() {
  return Boolean(
    window.SUPABASE_CONFIG?.url &&
    window.SUPABASE_CONFIG?.anonKey &&
    !window.SUPABASE_CONFIG.url.includes("YOUR_SUPABASE") &&
    !window.SUPABASE_CONFIG.anonKey.includes("YOUR_SUPABASE")
  );
}

async function initSupabase() {
  if (!isSupabaseConfigured()) return null;

  if (window.supabaseClient) {
    return window.supabaseClient;
  }

  if (!window.supabase) {
    throw new Error("Supabase JS library is not loaded.");
  }

  window.supabaseClient = window.supabase.createClient(
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

  return window.supabaseClient;
}
