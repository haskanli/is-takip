import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config.js";

let client;

export const getDatabaseClient = () => {
  if (!client) {
    const config = getSupabaseConfig();
    client = createClient(config.url, config.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
};
