import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AgentFulfillmentError,
  commissionAgentWithInitialKey,
  issueAgentKeyForAgent,
} from "@/lib/agent-fulfillment";
import type { AgentType, AgentProvider } from "@/lib/agent-permissions";
import { isAuthenticatedOrgUser, requirePlatformAdmin } from "@/lib/server-auth";
import { rateLimit } from "@/lib/rate-limit";

const VALID_AGENT_TYPES: readonly [AgentType, ...AgentType[]] = [
  "scribe", "strategist", "inspector", "researcher", "reviewer", "custom",
];
const VALID_PROVIDERS: readonly [AgentProvider, ...AgentProvider[]] = [
  "ghostwriters", "paperclip", "openclaw", "custom",
];

const ProvisionSchema = z.object({
  organization_id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  job_title: z.string().max(100).nullable().optional(),
  agent_type: z.enum(VALID_AGENT_TYPES),
  provider: z.enum(VALID_PROVIDERS),
  provider_agent_ref: z.string().min(1).max(150),
  allow_shared_context: z.boolean().optional(),
  permissions: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  const rateLimited = await rateLimit(`bridge:provision:${auth.profile.id}`, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ProvisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const {
    organization_id,
    user_id,
    name,
    job_title,
    agent_type,
    provider,
    provider_agent_ref,
    allow_shared_context = false,
    permissions,
  } = parsed.data;

  const admin = createAdminClient();

  // Idempotency: check if an agent with this provider_agent_ref already exists in the org
  const { data: existingAgent, error: lookupError } = await admin
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
        job_title,
        status,
        allow_shared_context,
        commissioned_by,
        created_at,
        updated_at,
        last_used_at,
        last_used_by_route,
        revoked_at,
        revoked_by,
        agent_permissions(permission),
        agent_keys(id, agent_id, key_prefix, created_at)
      `
    )
    .eq("organization_id", organization_id)
    .eq("provider", provider)
    .eq("provider_agent_ref", provider_agent_ref)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json(
      { error: "Failed to check for existing agent" },
      { status: 500 }
    );
  }

  if (existingAgent) {
    // Reject re-provisioning of revoked agents
    if (existingAgent.status !== "active" || existingAgent.revoked_at !== null) {
      return NextResponse.json(
        { error: "Agent has been revoked and cannot be re-provisioned" },
        { status: 409 }
      );
    }

    // Agent already provisioned — return existing record.
    // Issue a new key so the caller can authenticate the agent.
    try {
      const newKey = await issueAgentKeyForAgent({
        admin,
        agentId: existingAgent.id,
        commissionedByUserId: auth.profile.id,
      });

      return NextResponse.json({
        ...existingAgent,
        agent_keys: [{ id: newKey.id, agent_id: existingAgent.id, key_prefix: newKey.key_prefix, created_at: newKey.created_at }],
        permissions:
          existingAgent.agent_permissions?.map(
            (p: { permission: string }) => p.permission
          ) ?? [],
        assigned_user: { id: existingAgent.user_id },
        organization: { id: existingAgent.organization_id },
        revealed_key: newKey.api_key,
        idempotent: true,
      });
    } catch (error) {
      if (error instanceof AgentFulfillmentError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status }
        );
      }
      return NextResponse.json(
        { error: "Failed to issue key for existing agent" },
        { status: 500 }
      );
    }
  }

  // No existing agent — commission a new one
  try {
    const result = await commissionAgentWithInitialKey({
      admin,
      commissionedByUserId: auth.profile.id,
      organizationId: organization_id,
      userId: user_id,
      name,
      agentType: agent_type,
      provider,
      providerAgentRef: provider_agent_ref,
      jobTitle: job_title ?? null,
      allowSharedContext: allow_shared_context,
      permissions,
    });

    return NextResponse.json({ ...result, idempotent: false });
  } catch (error) {
    if (error instanceof AgentFulfillmentError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Failed to provision agent" },
      { status: 500 }
    );
  }
}
