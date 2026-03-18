import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthenticatedOrgUser, requireOrgUser } from "@/lib/server-auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: invitationId } = await params;
  const auth = await requireOrgUser(["owner"]);
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("user_invitations")
    .delete()
    .eq("id", invitationId)
    .eq("organization_id", auth.profile.organization_id)
    .is("accepted_at", null);

  if (error) {
    return NextResponse.json(
      { error: "Failed to revoke invitation" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
