import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AgentFulfillmentError,
  commissionAgentWithInitialKey,
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

const CreateAgentSchema = z.object({
  organization_id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  agent_type: z.enum(VALID_AGENT_TYPES),
  provider: z.enum(VALID_PROVIDERS),
  provider_agent_ref: z.string().max(150).nullable().optional(),
  job_title: z.string().max(100).nullable().optional(),
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

  const rateLimited = await rateLimit(`admin:commission-agent:${auth.profile.id}`, {
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
    job_title,
    allow_shared_context = false,
  } = parsed.data;

  try {
    const result = await commissionAgentWithInitialKey({
      admin,
      commissionedByUserId: auth.profile.id,
      organizationId: organization_id,
      userId: user_id,
      name,
      agentType: agent_type,
      provider,
      providerAgentRef: provider_agent_ref ?? null,
      jobTitle: job_title ?? null,
      allowSharedContext: allow_shared_context,
      permissions: parsed.data.permissions,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AgentFulfillmentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Failed to create commissioned agent" }, { status: 500 });
  }
}
