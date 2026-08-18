import { NextRequest, NextResponse } from "next/server";
import { filterProducts, getCatalogFilters } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const result = filterProducts({
    query: search.get("q") || undefined,
    category: search.get("category") || undefined,
    material: search.get("material") || undefined,
    color: search.get("color") || undefined,
    style: search.get("style") || undefined,
    price: (search.get("price") as "available" | "request" | null) || undefined,
    sort: search.get("sort") || undefined,
    page: Number(search.get("page") || 1),
    pageSize: Number(search.get("pageSize") || 24),
  });
  return NextResponse.json({ ...result, filters: getCatalogFilters() });
}
