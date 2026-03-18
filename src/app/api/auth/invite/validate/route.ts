import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPendingInvitationByToken } from "@/lib/invitations";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limited = await rateLimit(`invite-validate:${ip}`, { maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

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

  const { data: org } = await adminClient
    .from("organizations")
    .select("name")
    .eq("id", invitation.organization_id)
    .single();

  return NextResponse.json({
    organization_name: org?.name ?? "Unknown",
  });
}
