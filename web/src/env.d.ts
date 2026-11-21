/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. Leave unset to run the app on demo fixtures. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon (public) key. Never put the service_role key in the browser. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
