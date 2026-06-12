import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Supabase URL and key are required");

const client = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await client.from("app_state").select("*").eq("id", 1).single();
if (error) throw error;

await mkdir("backups", { recursive: true });
const stamp = new Date().toISOString().replaceAll(":", "-");
const path = `backups/app-state-${stamp}.json`;
await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log(`Backup created: ${path}`);
