import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthenticatedOrgUser, requirePlatformAdmin } from "@/lib/server-auth";

export async function GET(request: Request) {
  const auth = await requirePlatformAdmin();
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organization_id");
  const adminClient = createAdminClient();
  let query = adminClient
    .from("user_invitations")
    .select("id, organization_id, email, role, expires_at, created_at")
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data: invitations, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch invitations" },
      { status: 500 }
    );
  }

  return NextResponse.json(invitations);
}
