import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase URL and SUPABASE_SERVICE_ROLE_KEY are required");

const client = createClient(url, key, { auth: { persistSession: false } });
const { data: source, error: sourceError } = await client
  .from("app_state")
  .select("data,version")
  .eq("id", 1)
  .single();
if (sourceError) throw sourceError;

const expected = {
  profiles: source.data.people?.length || 0,
  projects: source.data.projects?.length || 0,
  milestones: (source.data.projects || []).reduce((sum, project) => sum + (project.milestones?.length || 0), 0),
  tasks:
    (source.data.projects || []).reduce(
      (sum, project) =>
        sum + (project.milestones || []).reduce((count, milestone) => count + (milestone.tasks?.length || 0), 0),
      0,
    ) + (source.data.personalTasks?.length || 0),
  tickets: Object.values(source.data.projectTickets || {}).reduce((sum, tickets) => sum + tickets.length, 0),
};

let failed = false;
for (const [table, expectedCount] of Object.entries(expected)) {
  const { count, error } = await client.from(table).select("*", { head: true, count: "exact" });
  if (error) throw error;
  const ok = count === expectedCount;
  if (!ok) failed = true;
  console.log(`${ok ? "OK" : "FAIL"} ${table}: expected=${expectedCount} actual=${count}`);
}

const { data: migration, error: migrationError } = await client
  .from("data_migrations")
  .select("name,applied_at")
  .eq("name", "app_state_to_normalized_v1")
  .maybeSingle();
if (migrationError) throw migrationError;
if (!migration) {
  failed = true;
  console.log("FAIL migration marker is missing");
} else {
  console.log(`OK migration marker: ${migration.applied_at}`);
}

if (failed) process.exitCode = 1;
else console.log(`Verification passed. app_state version=${source.version || 1}`);
