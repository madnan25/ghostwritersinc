import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ALL_AGENT_PERMISSIONS,
  DEFAULT_AGENT_PERMISSIONS,
  normalizeAgentName,
  titleizeAgentName,
} from "@/lib/agent-permissions";
import { generateAgentKey, getAgentKeyPrefix, hashAgentKey } from "@/lib/agent-auth";
import { isAuthenticatedOrgUser, requirePlatformAdmin } from "@/lib/server-auth";

const CreateAgentSchema = z.object({
  organization_id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  agent_type: z.string().min(1).max(50),
  provider: z.string().min(1).max(50),
  provider_agent_ref: z.string().max(150).nullable().optional(),
  allow_shared_context: z.boolean().optional(),
  permissions: z.array(z.string()).optional(),
});

export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  const admin = createAdminClient();
  const { data: agents, error } = await admin
    .from("agents")
    .select(
      `
        id,
        organization_id,
        user_id,
        name,
        slug,
        provider,
        provider_agent_ref,
        agent_type,
        status,
        allow_shared_context,
        commissioned_by,
        created_at,
        updated_at,
        last_used_at,
        last_used_by_route,
        revoked_at,
        revoked_by,
        organization:organizations(id, name),
        assigned_user:users!agents_user_id_fkey(id, name, email),
        agent_permissions(permission),
        agent_keys(id, key_prefix, created_at)
      `
    )
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch commissioned agents" }, { status: 500 });
  }

  return NextResponse.json(agents ?? []);
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateAgentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const {
    organization_id,
    user_id,
    name,
    agent_type,
    provider,
    provider_agent_ref,
    allow_shared_context = false,
  } = parsed.data;

  const permissionsInput = parsed.data.permissions?.filter((permission) =>
    (ALL_AGENT_PERMISSIONS as readonly string[]).includes(permission)
  );
  const permissions =
    permissionsInput && permissionsInput.length > 0
      ? Array.from(new Set(permissionsInput))
      : DEFAULT_AGENT_PERMISSIONS[agent_type as keyof typeof DEFAULT_AGENT_PERMISSIONS] ?? [];

  if (permissions.length === 0) {
    return NextResponse.json(
      { error: "Select at least one permission for this commissioned agent." },
      { status: 400 }
    );
  }

  const slug = normalizeAgentName(name);
  if (!slug) {
    return NextResponse.json({ error: "A valid agent name is required." }, { status: 400 });
  }

  const { data: assignedUser } = await admin
    .from("users")
    .select("id")
    .eq("id", user_id)
    .eq("organization_id", organization_id)
    .maybeSingle();

  if (!assignedUser) {
    return NextResponse.json(
      { error: "Assigned user was not found in the selected organization." },
      { status: 404 }
    );
  }

  const { data: existingAgent } = await admin
    .from("agents")
    .select("id")
    .eq("organization_id", organization_id)
    .eq("user_id", user_id)
    .eq("slug", slug)
    .maybeSingle();

  if (existingAgent) {
    return NextResponse.json(
      { error: "An agent with this name already exists for the selected user." },
      { status: 409 }
    );
  }

  const { data: agent, error: agentError } = await admin
    .from("agents")
    .insert({
      organization_id,
      user_id,
      name: titleizeAgentName(name),
      slug,
      provider,
      provider_agent_ref: provider_agent_ref ?? null,
      agent_type,
      status: "active",
      allow_shared_context,
      commissioned_by: auth.profile.id,
    })
    .select(
      `
        id,
        organization_id,
        user_id,
        name,
        slug,
        provider,
        provider_agent_ref,
        agent_type,
        status,
        allow_shared_context,
        commissioned_by,
        created_at,
        updated_at,
        last_used_at,
        last_used_by_route,
        revoked_at,
        revoked_by
      `
    )
    .single();

  if (agentError || !agent) {
    return NextResponse.json({ error: "Failed to create commissioned agent" }, { status: 500 });
  }

  const permissionRows = permissions.map((permission) => ({
    agent_id: agent.id,
    permission,
  }));

  const { error: permissionError } = await admin.from("agent_permissions").insert(permissionRows);
  if (permissionError) {
    await admin.from("agents").delete().eq("id", agent.id);
    return NextResponse.json({ error: "Failed to persist agent permissions" }, { status: 500 });
  }

  const plainKey = generateAgentKey();
  const keyHash = await hashAgentKey(plainKey);
  const keyPrefix = getAgentKeyPrefix(plainKey);

  const { data: key, error: keyError } = await admin
    .from("agent_keys")
    .insert({
      agent_id: agent.id,
      organization_id,
      user_id,
      agent_name: agent.agent_type,
      api_key_hash: keyHash,
      key_prefix: keyPrefix,
      permissions,
      allow_shared_context,
      commissioned_by: auth.profile.id,
    })
    .select("id, agent_id, key_prefix, created_at")
    .single();

  if (keyError || !key) {
    await admin.from("agent_permissions").delete().eq("agent_id", agent.id);
    await admin.from("agents").delete().eq("id", agent.id);
    return NextResponse.json({ error: "Failed to create initial agent key" }, { status: 500 });
  }

  return NextResponse.json({
    ...agent,
    permissions,
    assigned_user: { id: user_id },
    organization: { id: organization_id },
    agent_keys: [key],
    revealed_key: plainKey,
  });
}
