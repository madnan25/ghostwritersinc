import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  issueUserInvitation,
  InvitationFulfillmentError,
  normalizeRequestedRole,
} from "@/lib/invitation-fulfillment";
import { isAuthenticatedOrgUser, requirePlatformAdmin } from "@/lib/server-auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  const rateLimited = await rateLimit(`admin:invite:${auth.profile.id}`, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  const body = await request.json();
  const { email, role, organization_id } = body;

  if (!email || typeof email !== "string") {
    return NextResponse.json(
      { error: "email is required" },
      { status: 400 }
    );
  }

  const inviteRole = normalizeRequestedRole(role);

  const adminClient = createAdminClient();
  const requestUrl = new URL(request.url);
  const organizationId =
    typeof organization_id === "string" && organization_id.trim()
      ? organization_id
      : auth.profile.organization_id;

  try {
    const { invitation, inviteUrl } = await issueUserInvitation({
      adminClient,
      organizationId,
      invitedByUserId: auth.profile.id,
      email,
      role: inviteRole,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin,
    });

    return NextResponse.json({
      ...invitation,
      invite_url: inviteUrl,
    });
  } catch (error) {
    if (error instanceof InvitationFulfillmentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });
  }
}
