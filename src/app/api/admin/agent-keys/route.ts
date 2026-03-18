import { NextResponse } from "next/server";
import {
  DEFAULT_AGENT_PERMISSIONS,
} from "@/lib/agent-auth";
import { getSharedContextGuardMessage } from "@/lib/agent-context-sharing";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AgentFulfillmentError,
  commissionAgentWithInitialKey,
  issueAgentKeyForAgent,
} from "@/lib/agent-fulfillment";
import { isAuthenticatedOrgUser, requirePlatformAdmin } from "@/lib/server-auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  const rateLimited = await rateLimit(`admin:agent-keys:${auth.profile.id}`, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

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
    .select("id, allow_shared_context")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("agent_type", agentName)
    .maybeSingle();

  try {
    if (!existingAgent) {
      const result = await commissionAgentWithInitialKey({
        admin: adminClient,
        commissionedByUserId: auth.profile.id,
        organizationId,
        userId,
        name: agentName,
        agentType: agentName as keyof typeof DEFAULT_AGENT_PERMISSIONS,
        provider: "ghostwriters",
        allowSharedContext,
      });

      const key = result.agent_keys[0];
      return NextResponse.json({
        id: key.id,
        agent_id: key.agent_id,
        organization_id: organizationId,
        user_id: userId,
        agent_name: agentName,
        key_prefix: key.key_prefix,
        permissions: result.permissions,
        allow_shared_context: allowSharedContext,
        commissioned_by: auth.profile.id,
        created_at: key.created_at,
        api_key: result.revealed_key,
        warning: "Store this key securely. It cannot be retrieved again.",
      });
    }

    if (existingAgent.allow_shared_context !== allowSharedContext) {
      // Enforce org-level guard before enabling shared context
      if (allowSharedContext) {
        const { data: organization } = await adminClient
          .from("organizations")
          .select("context_sharing_enabled")
          .eq("id", organizationId)
          .maybeSingle();

        const guardMessage = getSharedContextGuardMessage({
          allowSharedContext: true,
          organizationContextSharingEnabled: organization?.context_sharing_enabled === true,
        });

        if (guardMessage) {
          return NextResponse.json({ error: guardMessage }, { status: 400 });
        }
      }

      const { error } = await adminClient
        .from("agents")
        .update({ allow_shared_context: allowSharedContext })
        .eq("id", existingAgent.id);

      if (error) {
        return NextResponse.json(
          { error: "Failed to update commissioned agent scope." },
          { status: 500 }
        );
      }
    }

    const result = await issueAgentKeyForAgent({
      admin: adminClient,
      agentId: existingAgent.id,
      commissionedByUserId: auth.profile.id,
    });

    return NextResponse.json({
      id: result.id,
      agent_id: result.agent_id,
      organization_id: organizationId,
      user_id: userId,
      agent_name: agentName,
      key_prefix: result.key_prefix,
      permissions: DEFAULT_AGENT_PERMISSIONS[agentName as keyof typeof DEFAULT_AGENT_PERMISSIONS],
      allow_shared_context: allowSharedContext,
      commissioned_by: auth.profile.id,
      created_at: result.created_at,
      api_key: result.api_key,
      warning: result.warning,
    });
  } catch (error) {
    if (error instanceof AgentFulfillmentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Failed to create agent key" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requirePlatformAdmin();
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  const rateLimitedDel = await rateLimit(`admin:delete-key:${auth.profile.id}`, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (rateLimitedDel) return rateLimitedDel;

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
