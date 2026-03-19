import { generateAgentKey, getAgentKeyPrefix, hashAgentKey } from "@/lib/agent-auth";
import { getSharedContextGuardMessage } from "@/lib/agent-context-sharing";
import {
  ALL_AGENT_PERMISSIONS,
  DEFAULT_AGENT_PERMISSIONS,
  normalizeAgentName,
  titleizeAgentName,
  type AgentProvider,
  type AgentType,
} from "@/lib/agent-permissions";
import { getAgentTeamPreset } from "@/lib/agent-team-presets";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export class AgentFulfillmentError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function assertSharedContextAllowed(
  admin: AdminClient,
  organizationId: string,
  allowSharedContext: boolean
) {
  const { data: organization, error } = await admin
    .from("organizations")
    .select("context_sharing_enabled")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    throw new AgentFulfillmentError("Failed to resolve organization sharing settings.", 500);
  }

  const guardMessage = getSharedContextGuardMessage({
    allowSharedContext,
    organizationContextSharingEnabled: organization?.context_sharing_enabled === true,
  });

  if (guardMessage) {
    throw new AgentFulfillmentError(guardMessage, 400);
  }

  return organization?.context_sharing_enabled === true;
}

function getValidatedPermissions(
  agentType: AgentType,
  permissions?: string[]
) {
  const explicitPermissions = permissions?.filter((permission) =>
    (ALL_AGENT_PERMISSIONS as readonly string[]).includes(permission)
  );

  const resolvedPermissions =
    explicitPermissions && explicitPermissions.length > 0
      ? Array.from(new Set(explicitPermissions))
      : DEFAULT_AGENT_PERMISSIONS[agentType] ?? [];

  if (resolvedPermissions.length === 0) {
    throw new AgentFulfillmentError(
      "Select at least one permission for this commissioned agent.",
      400
    );
  }

  return resolvedPermissions;
}

export async function commissionAgentWithInitialKey({
  admin,
  commissionedByUserId,
  organizationId,
  userId,
  name,
  agentType,
  provider,
  providerAgentRef = null,
  jobTitle = null,
  allowSharedContext = false,
  permissions,
}: {
  admin: AdminClient;
  commissionedByUserId: string;
  organizationId: string;
  userId: string;
  name: string;
  agentType: AgentType;
  provider: AgentProvider;
  providerAgentRef?: string | null;
  jobTitle?: string | null;
  allowSharedContext?: boolean;
  permissions?: string[];
}) {
  const slug = normalizeAgentName(name);
  if (!slug) {
    throw new AgentFulfillmentError("A valid agent name is required.", 400);
  }

  await assertSharedContextAllowed(admin, organizationId, allowSharedContext);

  const { data: assignedUser } = await admin
    .from("users")
    .select("id")
    .eq("id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!assignedUser) {
    throw new AgentFulfillmentError(
      "Assigned user was not found in the selected organization.",
      404
    );
  }

  const { data: existingAgent } = await admin
    .from("agents")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("slug", slug)
    .maybeSingle();

  if (existingAgent) {
    throw new AgentFulfillmentError(
      "An agent with this name already exists for the selected user.",
      409
    );
  }

  const resolvedPermissions = getValidatedPermissions(agentType, permissions);

  const { data: agent, error: agentError } = await admin
    .from("agents")
    .insert({
      organization_id: organizationId,
      user_id: userId,
      name: titleizeAgentName(name),
      slug,
      provider,
      provider_agent_ref: providerAgentRef ?? null,
      agent_type: agentType,
      job_title: jobTitle ?? null,
      status: "active",
      allow_shared_context: allowSharedContext,
      commissioned_by: commissionedByUserId,
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
        job_title,
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
    // Unique constraint on (organization_id, provider, provider_agent_ref) — concurrent race
    if (agentError?.code === "23505" && agentError.message?.includes("idx_agents_org_provider_ref")) {
      throw new AgentFulfillmentError(
        "An agent with this provider reference already exists (concurrent request).",
        409
      );
    }
    throw new AgentFulfillmentError("Failed to create commissioned agent", 500);
  }

  const { error: permissionError } = await admin.from("agent_permissions").insert(
    resolvedPermissions.map((permission) => ({
      agent_id: agent.id,
      permission,
    }))
  );

  if (permissionError) {
    await admin.from("agents").delete().eq("id", agent.id);
    throw new AgentFulfillmentError("Failed to persist agent permissions", 500);
  }

  const plainKey = generateAgentKey();
  const keyHash = await hashAgentKey(plainKey);
  const keyPrefix = getAgentKeyPrefix(plainKey);

  const { data: key, error: keyError } = await admin
    .from("agent_keys")
    .insert({
      agent_id: agent.id,
      organization_id: organizationId,
      user_id: userId,
      agent_name: agent.name,
      api_key_hash: keyHash,
      key_prefix: keyPrefix,
      permissions: resolvedPermissions,
      allow_shared_context: allowSharedContext,
      commissioned_by: commissionedByUserId,
    })
    .select("id, agent_id, key_prefix, created_at")
    .single();

  if (keyError || !key) {
    await admin.from("agent_permissions").delete().eq("agent_id", agent.id);
    await admin.from("agents").delete().eq("id", agent.id);
    throw new AgentFulfillmentError("Failed to create initial agent key", 500);
  }

  return {
    ...agent,
    permissions: resolvedPermissions,
    assigned_user: { id: userId },
    organization: { id: organizationId },
    agent_keys: [key],
    revealed_key: plainKey,
  };
}

export async function issueAgentKeyForAgent({
  admin,
  agentId,
  commissionedByUserId,
}: {
  admin: AdminClient;
  agentId: string;
  commissionedByUserId: string;
}) {
  const { data: agent } = await admin
    .from("agents")
    .select("id, name, organization_id, user_id, agent_type, allow_shared_context")
    .eq("id", agentId)
    .maybeSingle();

  if (!agent) {
    throw new AgentFulfillmentError("Commissioned agent not found", 404);
  }

  await assertSharedContextAllowed(
    admin,
    agent.organization_id,
    agent.allow_shared_context === true
  );

  const { data: permissionRows } = await admin
    .from("agent_permissions")
    .select("permission")
    .eq("agent_id", agentId);

  const permissions = permissionRows?.map((row) => row.permission).filter(Boolean) ?? [];
  if (permissions.length === 0) {
    throw new AgentFulfillmentError("This agent has no permissions assigned.", 400);
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
      agent_name: agent.name,
      api_key_hash: keyHash,
      key_prefix: keyPrefix,
      permissions,
      allow_shared_context: agent.allow_shared_context,
      commissioned_by: commissionedByUserId,
    })
    .select("id, agent_id, key_prefix, created_at")
    .single();

  if (error || !key) {
    throw new AgentFulfillmentError("Failed to create agent key", 500);
  }

  return {
    ...key,
    api_key: plainKey,
    warning: "Store this key securely. It cannot be retrieved again.",
  };
}

export async function commissionPresetAgentTeam({
  admin,
  commissionedByUserId,
  organizationId,
  userId,
  presetKey,
  allowSharedContext,
}: {
  admin: AdminClient;
  commissionedByUserId: string;
  organizationId: string;
  userId: string;
  presetKey: string;
  allowSharedContext: boolean;
}) {
  const preset = getAgentTeamPreset(presetKey);
  if (!preset) {
    throw new AgentFulfillmentError("Unknown agent team preset.", 400);
  }

  const commissionedAgents = [];
  try {
    for (const presetAgent of preset.agents) {
      const agent = await commissionAgentWithInitialKey({
        admin,
        commissionedByUserId,
        organizationId,
        userId,
        name: presetAgent.name,
        agentType: presetAgent.agent_type,
        provider: presetAgent.provider,
        allowSharedContext,
      });
      commissionedAgents.push(agent);
    }
  } catch (error) {
    // Rollback: clean up any agents that were successfully created before the failure.
    // commissionAgentWithInitialKey already handles its own internal rollback on
    // permission/key errors, so these agents are fully provisioned and need explicit cleanup.
    for (const agent of commissionedAgents) {
      await admin.from("agent_keys").delete().eq("agent_id", agent.id);
      await admin.from("agent_permissions").delete().eq("agent_id", agent.id);
      await admin.from("agents").delete().eq("id", agent.id);
    }
    throw error;
  }

  return commissionedAgents;
}
