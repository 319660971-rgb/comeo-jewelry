import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

type Table = "leads" | "quotes" | "wholesale_requests";

export async function persistRecord(table: Table, record: Record<string, unknown>) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await supabase.from(table).insert(record);
    if (!error) return { storage: "supabase" as const };
    console.error(`Supabase ${table} insert failed`, error.message);
  }

  if (process.env.VERCEL) {
    throw new Error("Persistent lead storage is not configured.");
  }

  const dataDir = path.join(process.cwd(), ".data");
  await fs.mkdir(dataDir, { recursive: true });
  await fs.appendFile(path.join(dataDir, `${table}.jsonl`), `${JSON.stringify(record)}\n`, "utf8");
  return { storage: "local" as const };
}

export function createReference(prefix: string) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
  return `${prefix}-${date}-${suffix}`;
}
