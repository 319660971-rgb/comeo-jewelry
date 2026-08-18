import { NextRequest, NextResponse } from "next/server";

const protectedPrefixes = ["/catalog", "/collections", "/products", "/selection"];

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const unlocked = request.cookies.get("hello_jewelry_access")?.value === "1";

  if (isProtected && !unlocked) {
    const url = request.nextUrl.clone();
    url.pathname = "/access";
    url.searchParams.set("from", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/catalog/:path*", "/collections/:path*", "/products/:path*", "/selection/:path*"],
};
