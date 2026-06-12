import { createClient } from "@supabase/supabase-js";
import { getServerConfig, getSupabaseConfig } from "./config.js";

let authClient;
const getAuthClient = () => {
  if (!authClient) {
    const config = getSupabaseConfig();
    authClient = createClient(config.url, config.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return authClient;
};

export const authenticateRequest = async (request) => {
  if (!getServerConfig().requireAuth) return null;
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) throw Object.assign(new Error("Authentication required"), { status: 401 });

  const client = getAuthClient();
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user) {
    throw Object.assign(new Error("Invalid or expired session"), { status: 401 });
  }
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id,legacy_id,email,name,is_admin,active")
    .eq("id", userData.user.id)
    .single();
  if (profileError || !profile?.active) {
    throw Object.assign(new Error("Active application profile not found"), { status: 403 });
  }
  return { user: userData.user, profile, token };
};

export const requireAdmin = (auth) => {
  if (!auth?.profile?.is_admin) {
    throw Object.assign(new Error("Administrator permission required"), { status: 403 });
  }
};
