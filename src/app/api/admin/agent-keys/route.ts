import { NextResponse } from "next/server";
import {
  generateAgentKey,
  getAgentKeyPrefix,
  hashAgentKey,
  DEFAULT_AGENT_PERMISSIONS,
} from "@/lib/agent-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeAgentName, titleizeAgentName } from "@/lib/agent-permissions";
import { isAuthenticatedOrgUser, requirePlatformAdmin } from "@/lib/server-auth";

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  const adminClient = createAdminClient();

  const body = await request.json();
  const agentName: string = body.agent_name;
  const organizationId: string = body.organization_id;
  const userId: string = body.user_id;
  const allowSharedContext = body.allow_shared_context === true;

  if (!agentName || typeof agentName !== "string") {
    return NextResponse.json(
      { error: "agent_name is required" },
      { status: 400 }
    );
  }

  if (!organizationId || typeof organizationId !== "string") {
    return NextResponse.json(
      { error: "organization_id is required" },
      { status: 400 }
    );
  }

  if (!userId || typeof userId !== "string") {
    return NextResponse.json(
      { error: "user_id is required" },
      { status: 400 }
    );
  }

  const validAgentNames = Object.keys(DEFAULT_AGENT_PERMISSIONS);
  if (!validAgentNames.includes(agentName)) {
    return NextResponse.json(
      { error: `Invalid agent_name. Must be one of: ${validAgentNames.join(", ")}` },
      { status: 400 }
    );
  }

  const normalizedName = normalizeAgentName(agentName);
  const { data: commissionedUser } = await adminClient
    .from("users")
    .select("id")
    .eq("id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!commissionedUser) {
    return NextResponse.json(
      { error: "Target user not found in the selected organization" },
      { status: 404 }
    );
  }

  const { data: existingAgent } = await adminClient
    .from("agents")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("agent_type", agentName)
    .maybeSingle();
  const permissions =
    DEFAULT_AGENT_PERMISSIONS[agentName as keyof typeof DEFAULT_AGENT_PERMISSIONS];

  let agentId = existingAgent?.id ?? null;

  if (!agentId) {
    const { data: createdAgent, error: agentError } = await adminClient
      .from("agents")
      .insert({
        organization_id: organizationId,
        user_id: userId,
        name: titleizeAgentName(agentName),
        slug: normalizedName,
        provider: "ghostwriters",
        agent_type: agentName,
        status: "active",
        allow_shared_context: allowSharedContext,
        commissioned_by: auth.profile.id,
      })
      .select("id")
      .single();

    if (agentError || !createdAgent) {
      return NextResponse.json(
        { error: "Failed to create commissioned agent" },
        { status: 500 }
      );
    }

    agentId = createdAgent.id;
    await adminClient.from("agent_permissions").insert(
      permissions.map((permission: string) => ({
        agent_id: agentId,
        permission,
      }))
    );
  }

  // Generate and hash the key
  const plainKey = generateAgentKey();
  const keyHash = await hashAgentKey(plainKey);
  const keyPrefix = getAgentKeyPrefix(plainKey);

  const { data: agentKey, error } = await adminClient
    .from("agent_keys")
    .insert({
      agent_id: agentId,
      organization_id: organizationId,
      user_id: userId,
      agent_name: agentName,
      api_key_hash: keyHash,
      key_prefix: keyPrefix,
      permissions,
      allow_shared_context: allowSharedContext,
      commissioned_by: auth.profile.id,
    })
    .select(
      "id, agent_id, organization_id, user_id, agent_name, key_prefix, permissions, allow_shared_context, commissioned_by, created_at"
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to create agent key" },
      { status: 500 }
    );
  }

  // Return plaintext key once — it cannot be retrieved again
  return NextResponse.json({
    ...agentKey,
    api_key: plainKey,
    warning: "Store this key securely. It cannot be retrieved again.",
  });
}

export async function DELETE(request: Request) {
  const auth = await requirePlatformAdmin();
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  const adminClient = createAdminClient();
  const { searchParams } = new URL(request.url);
  const keyId = searchParams.get("id");

  if (!keyId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { data: deletedKey, error } = await adminClient
    .from("agent_keys")
    .delete()
    .eq("id", keyId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to delete agent key" },
      { status: 500 }
    );
  }

  if (!deletedKey) {
    return NextResponse.json({ error: "Agent key not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, id: deletedKey.id });
}
