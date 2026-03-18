import { NextResponse } from "next/server";
import { normalizeInviteEmail } from "@/lib/invitations";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isAuthenticatedOrgUser,
  requireOrgAdminOrPlatformAdmin,
} from "@/lib/server-auth";
import { normalizeRequestedRole } from "@/lib/invitation-fulfillment";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const auth = await requireOrgAdminOrPlatformAdmin();
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);
  const requestedOrganizationId = searchParams.get("organization_id");
  const organizationId = auth.profile.is_platform_admin && requestedOrganizationId
    ? requestedOrganizationId
    : auth.profile.organization_id;

  const { data, error } = await admin
    .from("invite_requests")
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
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch invite requests" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const auth = await requireOrgAdminOrPlatformAdmin();
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  const rateLimited = await rateLimit(`org-admin:invite-request:${auth.profile.id}`, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  const body = await request.json();
  const email = typeof body.email === "string" ? body.email : "";
  const role = normalizeRequestedRole(body.role);
  const requestedOrganizationId =
    typeof body.organization_id === "string" ? body.organization_id : null;
  const organizationId =
    auth.profile.is_platform_admin && requestedOrganizationId
      ? requestedOrganizationId
      : auth.profile.organization_id;

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const normalizedEmail = normalizeInviteEmail(email);

  const { data: existingUser } = await admin
    .from("users")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingUser) {
    return NextResponse.json(
      { error: "User with this email already exists in the organization" },
      { status: 409 }
    );
  }

  const { data, error } = await admin
    .from("invite_requests")
    .insert({
      organization_id: organizationId,
      requested_by: auth.profile.id,
      requested_email: normalizedEmail,
      requested_role: role,
      status: "pending",
    })
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

  if (error || !data) {
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "A pending invite request already exists for this email" },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: "Failed to create invite request" }, { status: 500 });
  }

  return NextResponse.json(data);
}
