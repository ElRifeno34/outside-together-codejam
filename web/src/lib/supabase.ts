import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Only the public URL and anon key belong in the browser. Row level security and the
// SECURITY DEFINER RPCs in ../supabase/migrations decide what each caller may read or write.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isBrowser = typeof window !== "undefined";

/** null when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing: the app then shows a setup screen. */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          // Sessions live in the browser only; server-side rendering reads the public board anonymously.
          persistSession: isBrowser,
          autoRefreshToken: isBrowser,
          detectSessionInUrl: isBrowser,
          flowType: "pkce",
        },
      })
    : null;

export const backendMode: "supabase" | "unconfigured" = supabase ? "supabase" : "unconfigured";

/** Thrown when the app needs Supabase but the frontend environment variables are missing. */
export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super("Supabase is not configured");
    this.name = "SupabaseNotConfiguredError";
  }
}

export function isNotConfiguredError(error: unknown): boolean {
  return error instanceof Error && error.name === "SupabaseNotConfiguredError";
}
