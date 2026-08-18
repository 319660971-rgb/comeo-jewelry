import { NextRequest, NextResponse } from "next/server";
import { createReference, persistRecord } from "@/lib/persistence";
import { quoteSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const parsed = quoteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please review your contact and selection details." }, { status: 400 });
  const quoteId = createReference("HJQ");
  await persistRecord("quotes", {
    quote_id: quoteId,
    contact: {
      name: parsed.data.name,
      company: parsed.data.company,
      country: parsed.data.country,
      whatsapp: parsed.data.whatsapp,
      email: parsed.data.email || null,
    },
    items: parsed.data.items,
    note: parsed.data.note || null,
    status: "new",
    created_at: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true, quoteId });
}
