import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect admin API routes (GET /api/logs when accessed from admin)
  // The admin page itself is client-gated via the login form
  // Protect the API route from unauthenticated direct calls
  if (pathname.startsWith("/api/logs") || pathname.startsWith("/api/upload")) {
    // Allow captain form to post to /api/logs (POST is public)
    // Only gate admin-style GET on /api/logs behind cookie
    if (request.method === "GET" && pathname === "/api/logs") {
      const cookie = request.cookies.get("admin_auth");
      if (!cookie || cookie.value !== "1") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/logs", "/api/logs/:path*", "/api/upload"],
};
