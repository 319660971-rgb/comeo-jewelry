import { NextRequest, NextResponse } from "next/server";
import { createReference, persistRecord } from "@/lib/persistence";
import { leadSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const parsed = leadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check the required fields." }, { status: 400 });
  const leadId = createReference("LEAD");
  await persistRecord("leads", { lead_id: leadId, ...parsed.data, created_at: new Date().toISOString() });
  const response = NextResponse.json({ ok: true, leadId });
  response.cookies.set("hello_jewelry_access", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return response;
}
