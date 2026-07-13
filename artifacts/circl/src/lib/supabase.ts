import { createClient } from "@supabase/supabase-js";
import { setAuthTokenGetter } from "@workspace/api-client-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null;

setAuthTokenGetter(async () => {
  if (!supabase) return null;

  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
});

/**
 * Builds an absolute, environment-safe redirect URL for Supabase auth emails
 * (signup confirmation, magic links, password reset).
 *
 * Always derives the origin from `window.location.origin` at call time, so the
 * exact same code sends users back to `localhost:5173` in development and to
 * the real deployed domain in production — never a hardcoded host.
 *
 * `path` is relative to the app's base path (e.g. "reset-password", not
 * "/reset-password"); it is joined with `import.meta.env.BASE_URL` so the
 * artifact's routing prefix is respected in both environments.
 */
export function getAuthRedirectUrl(path: string = ""): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return `${window.location.origin}${base}${path}`
    .replace(/([^:]\/)\/+/g, "$1")
    .replace(/\/$/, "") || window.location.origin;
}
