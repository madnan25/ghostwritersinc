import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateInviteToken,
  hashInviteToken,
  normalizeInviteEmail,
} from "@/lib/invitations";
import type { UserRole } from "@/lib/types";

type AdminClient = ReturnType<typeof createAdminClient>;

export class InvitationFulfillmentError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function normalizeRequestedRole(role: string | undefined): UserRole {
  return role === "admin" ? "admin" : "member";
}

export async function issueUserInvitation({
  adminClient,
  organizationId,
  invitedByUserId,
  email,
  role,
  siteUrl,
}: {
  adminClient: AdminClient;
  organizationId: string;
  invitedByUserId: string;
  email: string;
  role: UserRole;
  siteUrl: string;
}) {
  const normalizedEmail = normalizeInviteEmail(email);

  const { data: existingUser } = await adminClient
    .from("users")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingUser) {
    throw new InvitationFulfillmentError(
      "User with this email already exists in the organization",
      409
    );
  }

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: invitation, error } = await adminClient
    .from("user_invitations")
    .insert({
      organization_id: organizationId,
      email: normalizedEmail,
      role,
      invited_by: invitedByUserId,
      token_hash: hashInviteToken(token),
      expires_at: expiresAt,
    })
    .select("id, organization_id, email, role, expires_at, created_at")
    .single();

  if (error || !invitation) {
    if (error?.code === "23505") {
      throw new InvitationFulfillmentError(
        "A pending invitation already exists for this email",
        409
      );
    }

    throw new InvitationFulfillmentError("Failed to create invitation", 500);
  }

  return {
    invitation,
    inviteUrl: `${siteUrl}/auth/invite?token=${token}`,
  };
}
