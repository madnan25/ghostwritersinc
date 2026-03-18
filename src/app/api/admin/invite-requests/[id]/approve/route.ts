import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  InvitationFulfillmentError,
  issueUserInvitation,
} from "@/lib/invitation-fulfillment";
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

  const rateLimited = await rateLimit(`admin:approve-invite:${auth.profile.id}`, {
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
  // This prevents duplicate invitations from concurrent approvals.
  const { data: claimed, error: claimError } = await admin
    .from("invite_requests")
    .update({
      status: "approved",
      reviewed_by: auth.profile.id,
      reviewed_at: new Date().toISOString(),
      decision_notes: decisionNotes,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id, organization_id, requested_email, requested_role")
    .maybeSingle();

  if (claimError) {
    return NextResponse.json({ error: "Failed to process invite request" }, { status: 500 });
  }

  if (!claimed) {
    const { data: existing } = await admin
      .from("invite_requests")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Invite request not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Only pending invite requests can be approved." },
      { status: 400 }
    );
  }

  const requestUrl = new URL(request.url);

  try {
    const { invitation, inviteUrl } = await issueUserInvitation({
      adminClient: admin,
      organizationId: claimed.organization_id,
      invitedByUserId: auth.profile.id,
      email: claimed.requested_email,
      role: claimed.requested_role,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin,
    });

    // Update with fulfilled invitation ID
    const { data: updated, error } = await admin
      .from("invite_requests")
      .update({
        fulfilled_invitation_id: invitation.id,
      })
      .eq("id", id)
      .select(
        `
          id,
          organization_id,
          requested_by,
          requested_email,
          requested_role,
          status,
          decision_notes,
          reviewed_by,
          reviewed_at,
          fulfilled_invitation_id,
          created_at,
          updated_at
        `
      )
      .single();

    if (error || !updated) {
      return NextResponse.json(
        { error: "Failed to update invite request after approval" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      request: updated,
      invitation: {
        ...invitation,
        invite_url: inviteUrl,
      },
    });
  } catch (error) {
    if (error instanceof InvitationFulfillmentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Failed to approve invite request" }, { status: 500 });
  }
}
