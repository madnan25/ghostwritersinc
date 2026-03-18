import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthenticatedOrgUser, requirePlatformAdmin } from "@/lib/server-auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformAdmin();
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  const rateLimited = await rateLimit(`admin:deny-hiring:${auth.profile.id}`, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const decisionNotes =
    typeof body.decision_notes === "string" ? body.decision_notes.trim() : null;

  const admin = createAdminClient();

  // Atomic compare-and-swap: only deny if still pending
  const { data, error } = await admin
    .from("agent_hiring_requests")
    .update({
      status: "denied",
      decision_notes: decisionNotes,
      reviewed_by: auth.profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select(
      `
        id,
        organization_id,
        requested_by,
        requested_for_user_id,
        preset_key,
        requested_shared_context,
        status,
        decision_notes,
        reviewed_by,
        reviewed_at,
        fulfilled_agent_ids,
        created_at,
        updated_at
      `
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to deny agent hiring request" },
      { status: 500 }
    );
  }

  if (!data) {
    const { data: existing } = await admin
      .from("agent_hiring_requests")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Agent hiring request not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Only pending hiring requests can be denied." },
      { status: 400 }
    );
  }

  return NextResponse.json(data);
}
