/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Release number baked in by the build (e.g. "1.0.14"); "0.0.0" on the website / local dev. */
declare const __APP_VERSION__: string
