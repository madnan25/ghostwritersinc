import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthenticatedOrgUser, requirePlatformAdmin } from "@/lib/server-auth";

export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  const adminClient = createAdminClient();
  const { data: users, error } = await adminClient
    .from("users")
    .select("id, name, email, avatar_url, role, is_active, is_platform_admin, created_at")
    .eq("organization_id", auth.profile.organization_id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }

  return NextResponse.json(users);
}
