import { createClient } from '@supabase/supabase-js'

const env = import.meta.env || (typeof process !== "undefined" ? process.env : {})
const url = env.VITE_SUPABASE_URL ?? "https://qmhpbztaiinenbkllduk.supabase.co"
const key = env.VITE_SUPABASE_ANON_KEY ?? "sb_publishable_pSEdLlx73rLCek0Lc6L75w_54_44zEV"

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
