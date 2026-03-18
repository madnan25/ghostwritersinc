import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPendingInvitationByToken,
  setInviteCookie,
} from "@/lib/invitations";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limited = await rateLimit(`invite-session:${ip}`, { maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  // CSRF protection: validate Origin header matches our host
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token =
    typeof body === "object" &&
    body !== null &&
    "token" in body &&
    typeof body.token === "string"
      ? body.token
      : null;

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const invitation = await getPendingInvitationByToken(adminClient, token);

  if (!invitation) {
    return NextResponse.json(
      { error: "Invalid or expired invitation" },
      { status: 404 }
    );
  }

  const cookieStore = await cookies();
  setInviteCookie(cookieStore, token);

  return NextResponse.json({ success: true });
}
