import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAgentKey, getAgentKeyPrefix, hashAgentKey } from "@/lib/agent-auth";
import { isAuthenticatedOrgUser, requirePlatformAdmin } from "@/lib/server-auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformAdmin();
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { data: agent } = await admin
    .from("agents")
    .select("id, organization_id, user_id, agent_type, allow_shared_context")
    .eq("id", id)
    .maybeSingle();

  if (!agent) {
    return NextResponse.json({ error: "Commissioned agent not found" }, { status: 404 });
  }

  const { data: permissionRows } = await admin
    .from("agent_permissions")
    .select("permission")
    .eq("agent_id", id);

  const permissions = permissionRows?.map((row) => row.permission).filter(Boolean) ?? [];
  if (permissions.length === 0) {
    return NextResponse.json(
      { error: "This agent has no permissions assigned." },
      { status: 400 }
    );
  }

  const plainKey = generateAgentKey();
  const keyHash = await hashAgentKey(plainKey);
  const keyPrefix = getAgentKeyPrefix(plainKey);

  const { data: key, error } = await admin
    .from("agent_keys")
    .insert({
      agent_id: agent.id,
      organization_id: agent.organization_id,
      user_id: agent.user_id,
      agent_name: agent.agent_type,
      api_key_hash: keyHash,
      key_prefix: keyPrefix,
      permissions,
      allow_shared_context: agent.allow_shared_context,
      commissioned_by: auth.profile.id,
    })
    .select("id, agent_id, key_prefix, created_at")
    .single();

  if (error || !key) {
    return NextResponse.json({ error: "Failed to create agent key" }, { status: 500 });
  }

  return NextResponse.json({
    ...key,
    api_key: plainKey,
    warning: "Store this key securely. It cannot be retrieved again.",
  });
}
