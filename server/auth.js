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
  const email = String(userData.user.email || "").trim().toLowerCase();
  let { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id,legacy_id,email,name,is_admin,active")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError) {
    throw Object.assign(new Error("Application profile lookup failed"), {
      status: 500,
    });
  }

  if (!profile && email) {
    const { data: emailProfile, error: emailProfileError } = await client
      .from("profiles")
      .select("id,legacy_id,email,name,is_admin,active")
      .eq("email", email)
      .maybeSingle();
    if (emailProfileError) {
      throw Object.assign(new Error("Application profile lookup failed"), {
        status: 500,
      });
    }
    profile = emailProfile;
  }

  if (!profile && email) {
    const { data: stateRecord, error: stateError } = await client
      .from("app_state")
      .select("data")
      .eq("id", 1)
      .single();
    if (stateError) {
      throw Object.assign(new Error("Application user lookup failed"), {
        status: 500,
      });
    }
    const person = (stateRecord?.data?.people || []).find(
      (item) => String(item.email || "").trim().toLowerCase() === email,
    );
    if (person) {
      const { data: createdProfile, error: createError } = await client
        .from("profiles")
        .insert({
          id: userData.user.id,
          legacy_id: person.id,
          email,
          name: person.name,
          role_title: person.role || "",
          phone: person.phone || "",
          avatar: person.avatar || "",
          is_admin: Boolean(person.isAdmin),
          whatsapp_enabled: person.whatsappEnabled !== false,
          active: person.active !== false,
          payload: person,
          updated_at: new Date().toISOString(),
        })
        .select("id,legacy_id,email,name,is_admin,active")
        .single();
      if (createError) {
        throw Object.assign(new Error("Application profile could not be created"), {
          status: 500,
        });
      }
      profile = createdProfile;
    }
  }

  if (!profile?.active) {
    throw Object.assign(new Error("Active application profile not found"), { status: 403 });
  }
  return { user: userData.user, profile, token };
};

export const requireAdmin = (auth) => {
  if (!auth?.profile?.is_admin) {
    throw Object.assign(new Error("Administrator permission required"), { status: 403 });
  }
};
