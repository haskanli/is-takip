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

const cleanEmail = (value) => String(value || "").trim().toLowerCase();

const findAuthUserByEmail = async (client, email) => {
  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return (data.users || []).find(
    (user) => cleanEmail(user.email) === email,
  );
};

export const ensureApplicationUser = async (person) => {
  const email = cleanEmail(person?.email);
  const legacyId = String(person?.id || "").trim();
  const name = String(person?.name || "").trim();
  if (!email || !legacyId || !name) {
    throw Object.assign(new Error("person.id, person.name and person.email are required"), {
      status: 400,
    });
  }

  const client = getAuthClient();
  let authUser = await findAuthUserByEmail(client, email);
  let createdAuthUser = false;
  if (!authUser) {
    const { data, error } = await client.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name, legacy_id: legacyId },
    });
    if (error) throw Object.assign(new Error(error.message), { status: 422 });
    authUser = data.user;
    createdAuthUser = true;
  } else {
    const { error: updateAuthError } = await client.auth.admin.updateUserById(authUser.id, {
      email_confirm: true,
      user_metadata: {
        ...(authUser.user_metadata || {}),
        name,
        legacy_id: legacyId,
      },
    });
    if (updateAuthError) {
      throw Object.assign(new Error(updateAuthError.message), { status: 422 });
    }
  }

  const { data: legacyProfile, error: legacyProfileError } = await client
    .from("profiles")
    .select("id,email,legacy_id")
    .eq("legacy_id", legacyId)
    .maybeSingle();
  if (legacyProfileError) {
    throw Object.assign(new Error("Profile lookup failed"), { status: 500 });
  }
  let existingProfile = legacyProfile;
  if (!existingProfile) {
    const { data: emailProfile, error: emailProfileError } = await client
      .from("profiles")
      .select("id,email,legacy_id")
      .eq("email", email)
      .maybeSingle();
    if (emailProfileError) {
      throw Object.assign(new Error("Profile lookup failed"), { status: 500 });
    }
    existingProfile = emailProfile;
  }

  const profile = {
    id: existingProfile?.id || authUser.id,
    legacy_id: legacyId,
    email,
    name,
    role_title: person.role || "",
    phone: person.phone || "",
    avatar: person.avatar || "",
    is_admin: Boolean(person.isAdmin),
    whatsapp_enabled: person.whatsappEnabled !== false,
    active: person.active !== false,
    payload: person,
    updated_at: new Date().toISOString(),
  };
  const { error: upsertError } = await client
    .from("profiles")
    .upsert(profile, { onConflict: "id" });
  if (upsertError) {
    throw Object.assign(new Error("Profile could not be saved"), { status: 500 });
  }

  return {
    userId: authUser.id,
    profileId: profile.id,
    createdAuthUser,
    updatedProfile: Boolean(existingProfile),
  };
};
