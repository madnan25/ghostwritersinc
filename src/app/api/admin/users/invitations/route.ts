import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthenticatedOrgUser, requirePlatformAdmin } from "@/lib/server-auth";

export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  const adminClient = createAdminClient();
  const { data: invitations, error } = await adminClient
    .from("user_invitations")
    .select("id, email, role, expires_at, created_at")
    .eq("organization_id", auth.profile.organization_id)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch invitations" },
      { status: 500 }
    );
  }

  return NextResponse.json(invitations);
}
