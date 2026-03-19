import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isAuthenticatedOrgUser,
  requireOrgAdminOrPlatformAdmin,
} from "@/lib/server-auth";

export async function GET(request: Request) {
  const auth = await requireOrgAdminOrPlatformAdmin();
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);
  const requestedOrganizationId = searchParams.get("organization_id");
  const organizationId =
    auth.profile.is_platform_admin && requestedOrganizationId
      ? requestedOrganizationId
      : auth.profile.organization_id;

  const { data, error } = await admin
    .from("users")
    .select("id, name, email, role, is_active")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch organization members" },
      { status: 500 }
    );
  }

  return NextResponse.json(data ?? []);
}
