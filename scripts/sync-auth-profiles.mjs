import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error(
    "SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
  );
}

const client = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const cleanEmail = (value) => String(value || "").trim().toLowerCase();

const { data: stateRecord, error: stateError } = await client
  .from("app_state")
  .select("data")
  .eq("id", 1)
  .single();
if (stateError) throw stateError;

const { data: authResult, error: authError } =
  await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (authError) throw authError;

const { data: profiles, error: profileError } = await client
  .from("profiles")
  .select("id,email,legacy_id");
if (profileError) throw profileError;

const usersByEmail = new Map(
  authResult.users.map((user) => [cleanEmail(user.email), user]),
);
const profilesByEmail = new Map(
  profiles.map((profile) => [cleanEmail(profile.email), profile]),
);
const profilesByLegacyId = new Map(
  profiles.map((profile) => [profile.legacy_id, profile]),
);
let createdUsers = 0;
let createdProfiles = 0;
let updatedProfiles = 0;

for (const person of stateRecord?.data?.people || []) {
  const email = cleanEmail(person.email);
  if (!email) continue;
  let authUser = usersByEmail.get(email);
  if (!authUser) {
    const { data, error } = await client.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name: person.name, legacy_id: person.id },
    });
    if (error) throw new Error(`Auth user ${email}: ${error.message}`);
    authUser = data.user;
    usersByEmail.set(email, authUser);
    createdUsers += 1;
  }

  const existingProfile =
    profilesByEmail.get(email) || profilesByLegacyId.get(person.id);
  const profile = {
    id: existingProfile?.id || authUser.id,
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
  };
  const { error } = await client
    .from("profiles")
    .upsert(profile, { onConflict: "id" });
  if (error) throw new Error(`Profile ${email}: ${error.message}`);
  if (existingProfile) updatedProfiles += 1;
  else createdProfiles += 1;
  profilesByEmail.set(email, profile);
  profilesByLegacyId.set(person.id, profile);
}

console.log(
  JSON.stringify(
    {
      people: (stateRecord?.data?.people || []).length,
      createdUsers,
      createdProfiles,
      updatedProfiles,
    },
    null,
    2,
  ),
);
