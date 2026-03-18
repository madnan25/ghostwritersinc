import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthenticatedOrgUser, requireOrgUser } from "@/lib/server-auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params;
  const auth = await requireOrgUser(["owner"]);
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  // Cannot modify yourself
  if (targetUserId === auth.user.id) {
    return NextResponse.json(
      { error: "Cannot modify your own account" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { is_active, role } = body;

  const adminClient = createAdminClient();

  // Verify target user is in the same org
  const { data: targetUser } = await adminClient
    .from("users")
    .select("id, organization_id, role")
    .eq("id", targetUserId)
    .eq("organization_id", auth.profile.organization_id)
    .single();

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Guard against removing/deactivating the last active owner
  const isRemovingOwnerRole = role && role !== "owner" && targetUser.role === "owner";
  const isDeactivatingOwner = is_active === false && targetUser.role === "owner";

  if (isRemovingOwnerRole || isDeactivatingOwner) {
    const { count } = await adminClient
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", auth.profile.organization_id)
      .eq("role", "owner")
      .eq("is_active", true);

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: isDeactivatingOwner ? "Cannot deactivate the last owner" : "Cannot remove the last owner" },
        { status: 400 }
      );
    }
  }

  // Build update payload
  const update: Record<string, unknown> = {};
  if (typeof is_active === "boolean") update.is_active = is_active;
  if (role && ["owner", "admin", "member"].includes(role)) update.role = role;

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const { data: updated, error } = await adminClient
    .from("users")
    .update(update)
    .eq("id", targetUserId)
    .select("id, name, email, avatar_url, role, is_active, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }

  return NextResponse.json(updated);
}
