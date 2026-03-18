import { NextResponse } from "next/server";
import { getSharedContextGuardMessage } from "@/lib/agent-context-sharing";
import { getAgentTeamPreset } from "@/lib/agent-team-presets";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isAuthenticatedOrgUser,
  requireOrgAdminOrPlatformAdmin,
} from "@/lib/server-auth";
import { rateLimit } from "@/lib/rate-limit";

const SELECT_FIELDS = `
  id,
  organization_id,
  requested_by,
  requested_for_user_id,
  preset_key,
  requested_shared_context,
  status,
  decision_notes,
  reviewed_by,
  reviewed_at,
  fulfilled_agent_ids,
  created_at,
  updated_at
`;

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
    .from("agent_hiring_requests")
    .select(SELECT_FIELDS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch agent hiring requests" },
      { status: 500 }
    );
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const auth = await requireOrgAdminOrPlatformAdmin();
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  const rateLimited = await rateLimit(`org-admin:hiring-request:${auth.profile.id}`, {
    maxRequests: 5,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  const body = await request.json();
  const requestedForUserId =
    typeof body.requested_for_user_id === "string" ? body.requested_for_user_id : "";
  const presetKey = typeof body.preset_key === "string" ? body.preset_key : "";
  const requestedSharedContext = body.requested_shared_context === true;
  const requestedOrganizationId =
    typeof body.organization_id === "string" ? body.organization_id : null;
  const organizationId =
    auth.profile.is_platform_admin && requestedOrganizationId
      ? requestedOrganizationId
      : auth.profile.organization_id;

  if (!requestedForUserId) {
    return NextResponse.json({ error: "requested_for_user_id is required" }, { status: 400 });
  }

  if (!getAgentTeamPreset(presetKey)) {
    return NextResponse.json({ error: "Invalid agent team preset" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("context_sharing_enabled")
    .eq("id", organizationId)
    .maybeSingle();

  if (organizationError) {
    return NextResponse.json(
      { error: "Failed to resolve organization sharing settings." },
      { status: 500 }
    );
  }

  const guardMessage = getSharedContextGuardMessage({
    allowSharedContext: requestedSharedContext,
    organizationContextSharingEnabled: organization?.context_sharing_enabled === true,
  });

  if (guardMessage) {
    return NextResponse.json({ error: guardMessage }, { status: 400 });
  }

  const { data: user } = await admin
    .from("users")
    .select("id")
    .eq("id", requestedForUserId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!user) {
    return NextResponse.json(
      { error: "Requested user was not found in this organization." },
      { status: 404 }
    );
  }

  const { data, error } = await admin
    .from("agent_hiring_requests")
    .insert({
      organization_id: organizationId,
      requested_by: auth.profile.id,
      requested_for_user_id: requestedForUserId,
      preset_key: presetKey,
      requested_shared_context: requestedSharedContext,
      status: "pending",
    })
    .select(SELECT_FIELDS)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Failed to create agent hiring request" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
