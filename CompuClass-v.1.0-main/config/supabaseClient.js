// Public client settings. EXPO_PUBLIC_* values are compiled into the app.
// An empty URL makes @supabase/supabase-js throw "supabaseUrl is required"
// while the module is still loading, before React can show an error. A release
// APK then closes on the splash screen.

export function readSupabasePublicConfig(env = process.env) {
  const url = String(env?.EXPO_PUBLIC_SUPABASE_URL || '').trim();
  const anonKey = String(env?.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  return {
    url,
    anonKey,
    configured: url.length > 0 && anonKey.length > 0,
  };
}

export function buildSupabaseClient(config, create, options) {
  if (!config?.configured) return null;
  return create(config.url, config.anonKey, options);
}

export function missingSupabaseConfigMessage() {
  return {
    title: 'CompuClass could not start',
    body: 'This build is missing EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY. Add both to the EAS preview environment, then rebuild.',
  };
}
