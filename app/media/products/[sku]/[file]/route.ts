import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const DATA_DIR = process.env.QIFU_DATA_DIR || path.join(process.cwd(), "outputs", "QIFU-2026-08-13");
const R2_BASE = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ sku: string; file: string }> }) {
  const { sku, file } = await context.params;
  if (!/^[A-Za-z0-9_-]+$/.test(sku) || !/^\d+\.(?:jpg|jpeg|png|webp)$/i.test(file)) return new NextResponse("Not found", { status: 404 });
  if (R2_BASE) return NextResponse.redirect(`${R2_BASE}/products/${encodeURIComponent(sku)}/${encodeURIComponent(file)}`, 307);
  const filename = path.join(DATA_DIR, "images", sku, file);
  try {
    const bytes = await fs.readFile(filename);
    const extension = path.extname(file).toLowerCase();
    const contentType = extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
    return new NextResponse(bytes, { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
