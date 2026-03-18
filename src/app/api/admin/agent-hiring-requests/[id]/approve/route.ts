import { NextResponse } from "next/server";
import {
  AgentFulfillmentError,
  commissionPresetAgentTeam,
} from "@/lib/agent-fulfillment";
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

  const rateLimited = await rateLimit(`admin:approve-hiring:${auth.profile.id}`, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const decisionNotes =
    typeof body.decision_notes === "string" ? body.decision_notes.trim() : null;

  const admin = createAdminClient();

  // Atomic compare-and-swap: claim the request before doing any work.
  // This prevents duplicate agent teams from concurrent approvals.
  const { data: claimed, error: claimError } = await admin
    .from("agent_hiring_requests")
    .update({
      status: "approved",
      reviewed_by: auth.profile.id,
      reviewed_at: new Date().toISOString(),
      decision_notes: decisionNotes,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select(
      "id, organization_id, requested_for_user_id, preset_key, requested_shared_context"
    )
    .maybeSingle();

  if (claimError) {
    return NextResponse.json({ error: "Failed to process hiring request" }, { status: 500 });
  }

  if (!claimed) {
    // Either not found or already approved/denied
    const { data: existing } = await admin
      .from("agent_hiring_requests")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Agent hiring request not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Only pending hiring requests can be approved." },
      { status: 400 }
    );
  }

  try {
    const commissionedAgents = await commissionPresetAgentTeam({
      admin,
      commissionedByUserId: auth.profile.id,
      organizationId: claimed.organization_id,
      userId: claimed.requested_for_user_id,
      presetKey: claimed.preset_key,
      allowSharedContext: claimed.requested_shared_context,
    });

    // Update with fulfilled agent IDs
    const { data: updated, error } = await admin
      .from("agent_hiring_requests")
      .update({
        fulfilled_agent_ids: commissionedAgents.map((agent) => agent.id),
      })
      .eq("id", id)
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

    if (error || !updated) {
      return NextResponse.json(
        { error: "Failed to update hiring request after approval" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      request: updated,
      commissioned_agents: commissionedAgents,
    });
  } catch (error) {
    if (error instanceof AgentFulfillmentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Failed to approve agent hiring request" },
      { status: 500 }
    );
  }
}
