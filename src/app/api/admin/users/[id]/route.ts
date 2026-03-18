import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthenticatedOrgUser, requirePlatformAdmin } from "@/lib/server-auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params;
  const auth = await requirePlatformAdmin();
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
    .select("id, organization_id, role, is_platform_admin, is_active")
    .eq("id", targetUserId)
    .eq("organization_id", auth.profile.organization_id)
    .single();

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Guard against removing/deactivating the last active org admin
  const isRemovingAdminRole = role === "member" && targetUser.role === "admin";
  const isDeactivatingAdmin = is_active === false && targetUser.role === "admin";
  const isDeactivatingPlatformAdmin = is_active === false && targetUser.is_platform_admin;

  if (isRemovingAdminRole || isDeactivatingAdmin) {
    const { count } = await adminClient
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", auth.profile.organization_id)
      .eq("role", "admin")
      .eq("is_active", true);

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: isDeactivatingAdmin ? "Cannot deactivate the last admin" : "Cannot remove the last admin" },
        { status: 400 }
      );
    }
  }

  if (isDeactivatingPlatformAdmin) {
    const { count } = await adminClient
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", auth.profile.organization_id)
      .eq("is_platform_admin", true)
      .eq("is_active", true);

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Cannot deactivate the last platform admin" },
        { status: 400 }
      );
    }
  }

  // Build update payload
  const update: Record<string, unknown> = {};
  if (typeof is_active === "boolean") update.is_active = is_active;
  if (role && ["admin", "member"].includes(role)) update.role = role;

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
    .select("id, name, email, avatar_url, role, is_active, is_platform_admin, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params;
  const auth = await requirePlatformAdmin();
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  if (targetUserId === auth.user.id) {
    return NextResponse.json(
      { error: "Cannot delete your own account" },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();
  const { data: targetUser, error: targetUserError } = await adminClient
    .from("users")
    .select("id, organization_id, role, is_platform_admin, is_active")
    .eq("id", targetUserId)
    .eq("organization_id", auth.profile.organization_id)
    .single();

  if (targetUserError || !targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (targetUser.role === "admin" && targetUser.is_active) {
    const { count } = await adminClient
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", auth.profile.organization_id)
      .eq("role", "admin")
      .eq("is_active", true);

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the last active admin" },
        { status: 400 }
      );
    }
  }

  if (targetUser.is_platform_admin && targetUser.is_active) {
    const { count } = await adminClient
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", auth.profile.organization_id)
      .eq("is_platform_admin", true)
      .eq("is_active", true);

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the last active platform admin" },
        { status: 400 }
      );
    }
  }

  const { error } = await adminClient.auth.admin.deleteUser(targetUserId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, id: targetUserId });
}
