/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_USE_MOCKS?: string
  readonly VITE_DEMO_PRICE_ETB?: string
  readonly VITE_REQUIRE_PAYMENT?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
