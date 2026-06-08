import { NextRequest, NextResponse } from "next/server";

function isAuthed(request: NextRequest) {
  const cookie = request.cookies.get("admin_auth");
  return cookie?.value === "1";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { method } = request;

  // GET /api/logs → admin only
  if (pathname === "/api/logs" && method === "GET") {
    if (!isAuthed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // DELETE /api/logs/[id] → admin only
  if (pathname.startsWith("/api/logs/") && method === "DELETE") {
    if (!isAuthed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // All writes to captains/boats → admin only
  if ((pathname.startsWith("/api/captains") || pathname.startsWith("/api/boats")) &&
      (method === "POST" || method === "DELETE")) {
    if (!isAuthed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/logs", "/api/logs/:path*", "/api/captains/:path*", "/api/boats/:path*"],
};
