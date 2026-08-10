/// <reference types="vite/client" />

// Beslut B etapp 1: appens egna miljövariabler. BARA publika värden får ligga i
// klientkoden/.env — den hemliga service_role-nyckeln bor ENDAST i Vercels
// miljövariabler och nås aldrig härifrån.
interface ImportMetaEnv {
  /** Supabase-projektets bas-URL, t.ex. https://xxxx.supabase.co */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon/public-nyckel (JWT, börjar med eyJ) — säker att bäddas in
   *  (skyddas av RLS). */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
