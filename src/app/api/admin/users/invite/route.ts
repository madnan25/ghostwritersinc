import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateInviteToken,
  hashInviteToken,
  normalizeInviteEmail,
} from "@/lib/invitations";
import { isAuthenticatedOrgUser, requireOrgUser } from "@/lib/server-auth";

export async function POST(request: Request) {
  const auth = await requireOrgUser(["owner"]);
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  const body = await request.json();
  const { email, role } = body;

  if (!email || typeof email !== "string") {
    return NextResponse.json(
      { error: "email is required" },
      { status: 400 }
    );
  }

  const validRoles = ["owner", "admin", "member"];
  const inviteRole = role && validRoles.includes(role) ? role : "member";
  const normalizedEmail = normalizeInviteEmail(email);

  const adminClient = createAdminClient();

  // Check if user already exists in this org
  const { data: existingUser } = await adminClient
    .from("users")
    .select("id")
    .eq("organization_id", auth.profile.organization_id)
    .eq("email", normalizedEmail)
    .single();

  if (existingUser) {
    return NextResponse.json(
      { error: "User with this email already exists in the organization" },
      { status: 409 }
    );
  }

  // Generate secure token
  const token = generateInviteToken();
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString(); // 7 days

  const { data: invitation, error } = await adminClient
    .from("user_invitations")
    .insert({
      organization_id: auth.profile.organization_id,
      email: normalizedEmail,
      role: inviteRole,
      invited_by: auth.profile.id,
      token_hash: hashInviteToken(token),
      expires_at: expiresAt,
    })
    .select("id, email, role, expires_at, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A pending invitation already exists for this email" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create invitation" },
      { status: 500 }
    );
  }

  // Build invite URL
  const requestUrl = new URL(request.url);
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    requestUrl.origin;
  const inviteUrl = `${baseUrl}/auth/invite?token=${token}`;

  return NextResponse.json({
    ...invitation,
    invite_url: inviteUrl,
  });
}
