import fs from "node:fs/promises";
import path from "node:path";
import { createCipheriv, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { put } from "@vercel/blob";

type Table = "leads" | "quotes" | "wholesale_requests";

export async function persistRecord(table: Table, record: Record<string, unknown>) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await supabase.from(table).insert(record);
    if (!error) return { storage: "supabase" as const };
    console.error(`Supabase ${table} insert failed, using local fallback`, error.message);
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const encryptionKey = process.env.LEADS_ENCRYPTION_KEY;
  if (blobToken && encryptionKey) {
    const key = Buffer.from(encryptionKey, "base64");
    if (key.length !== 32) throw new Error("LEADS_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(record), "utf8"), cipher.final()]);
    const encryptedRecord = JSON.stringify({
      version: 1,
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    });
    const date = new Date().toISOString().slice(0, 10);
    await put(`records/${table}/${date}/${crypto.randomUUID()}.json.enc`, encryptedRecord, {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
      token: blobToken,
    });
    return { storage: "blob" as const };
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
