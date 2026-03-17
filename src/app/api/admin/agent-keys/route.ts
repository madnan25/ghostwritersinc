import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateAgentKey,
  hashAgentKey,
  DEFAULT_AGENT_PERMISSIONS,
} from "@/lib/agent-auth";

export async function POST(request: Request) {
  const supabase = await createClient();

  // Verify authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify user is owner/admin
  const { data: dbUser } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (!dbUser || !["owner", "admin"].includes(dbUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    .eq("organization_id", dbUser.organization_id)
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
  const keyPrefix = plainKey.slice(0, 8);
  const permissions = DEFAULT_AGENT_PERMISSIONS[agentName];

  const { data: agentKey, error } = await supabase
    .from("agent_keys")
    .insert({
      organization_id: dbUser.organization_id,
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
