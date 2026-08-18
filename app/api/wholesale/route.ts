import { NextRequest, NextResponse } from "next/server";
import { createReference, persistRecord } from "@/lib/persistence";
import { wholesaleSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const parsed = wholesaleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please complete the required fields." }, { status: 400 });
  const requestId = createReference("STORE");
  await persistRecord("wholesale_requests", { request_id: requestId, ...parsed.data, created_at: new Date().toISOString(), status: "new" });
  return NextResponse.json({ ok: true, requestId });
}
