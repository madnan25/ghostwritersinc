import { NextResponse } from "next/server";
import {
  generateAgentKey,
  getAgentKeyPrefix,
  hashAgentKey,
  DEFAULT_AGENT_PERMISSIONS,
} from "@/lib/agent-auth";
import { isAuthenticatedOrgUser, requireOrgUser } from "@/lib/server-auth";

export async function POST(request: Request) {
  const auth = await requireOrgUser(["owner", "admin"]);
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  const { supabase, profile } = auth;

  const body = await request.json();
  const agentName: string = body.agent_name;

  if (!agentName || typeof agentName !== "string") {
    return NextResponse.json(
      { error: "agent_name is required" },
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

  // Check if key already exists for this agent in this org
  const { data: existing } = await supabase
    .from("agent_keys")
    .select("id")
    .eq("organization_id", profile.organization_id)
    .eq("agent_name", agentName)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: `Agent key for "${agentName}" already exists. Delete it first to regenerate.` },
      { status: 409 }
    );
  }

  // Generate and hash the key
  const plainKey = generateAgentKey();
  const keyHash = await hashAgentKey(plainKey);
  const keyPrefix = getAgentKeyPrefix(plainKey);
  const permissions = DEFAULT_AGENT_PERMISSIONS[agentName];

  const { data: agentKey, error } = await supabase
    .from("agent_keys")
    .insert({
      organization_id: profile.organization_id,
      agent_name: agentName,
      api_key_hash: keyHash,
      key_prefix: keyPrefix,
      permissions,
    })
    .select("id, agent_name, key_prefix, permissions, created_at")
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
  const auth = await requireOrgUser(["owner", "admin"]);
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  const { supabase, profile } = auth;
  const { searchParams } = new URL(request.url);
  const keyId = searchParams.get("id");

  if (!keyId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { data: deletedKey, error } = await supabase
    .from("agent_keys")
    .delete()
    .eq("id", keyId)
    .eq("organization_id", profile.organization_id)
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
