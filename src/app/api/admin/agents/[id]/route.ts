import { NextResponse } from "next/server";
import { z } from "zod";
import { getSharedContextGuardMessage } from "@/lib/agent-context-sharing";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALL_AGENT_PERMISSIONS } from "@/lib/agent-permissions";
import { isAuthenticatedOrgUser, requirePlatformAdmin } from "@/lib/server-auth";
import { rateLimit } from "@/lib/rate-limit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UpdateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  job_title: z.string().max(100).nullable().optional(),
  provider_agent_ref: z.string().max(150).nullable().optional(),
  status: z.enum(["active", "inactive", "revoked"]).optional(),
  allow_shared_context: z.boolean().optional(),
  permissions: z.array(z.string()).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformAdmin();
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  const rateLimited = await rateLimit(`admin:update-agent:${auth.profile.id}`, {
    maxRequests: 20,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid agent ID" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = UpdateAgentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const update: Record<string, unknown> = {};

  if (parsed.data.allow_shared_context === true) {
    const { data: agentScope, error: agentScopeError } = await admin
      .from("agents")
      .select("organization_id")
      .eq("id", id)
      .maybeSingle();

    if (agentScopeError || !agentScope) {
      return NextResponse.json({ error: "Failed to resolve commissioned agent" }, { status: 500 });
    }

    const { data: organization, error: organizationError } = await admin
      .from("organizations")
      .select("context_sharing_enabled")
      .eq("id", agentScope.organization_id)
      .maybeSingle();

    if (organizationError) {
      return NextResponse.json(
        { error: "Failed to resolve organization sharing settings." },
        { status: 500 }
      );
    }

    const guardMessage = getSharedContextGuardMessage({
      allowSharedContext: true,
      organizationContextSharingEnabled: organization?.context_sharing_enabled === true,
    });

    if (guardMessage) {
      return NextResponse.json({ error: guardMessage }, { status: 400 });
    }
  }

  // Validate permissions up-front (before any writes) to avoid partial updates
  let validatedPermissions: string[] | undefined;
  if (parsed.data.permissions) {
    validatedPermissions = Array.from(
      new Set(
        parsed.data.permissions.filter((permission) =>
          (ALL_AGENT_PERMISSIONS as readonly string[]).includes(permission)
        )
      )
    );

    if (validatedPermissions.length === 0) {
      return NextResponse.json(
        { error: "At least one valid permission is required." },
        { status: 400 }
      );
    }
  }

  if (parsed.data.name) update.name = parsed.data.name.trim();
  if ("job_title" in parsed.data) {
    update.job_title = parsed.data.job_title?.trim() ?? null;
  }
  if ("provider_agent_ref" in parsed.data) {
    update.provider_agent_ref = parsed.data.provider_agent_ref ?? null;
  }
  if (parsed.data.status) {
    update.status = parsed.data.status;
    if (parsed.data.status === "revoked") {
      update.revoked_at = new Date().toISOString();
      update.revoked_by = auth.profile.id;
    }
  }
  if (typeof parsed.data.allow_shared_context === "boolean") {
    update.allow_shared_context = parsed.data.allow_shared_context;
  }

  const { data: agent, error: agentError } = await admin
    .from("agents")
    .update(update)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (agentError || !agent) {
    return NextResponse.json({ error: "Failed to update commissioned agent" }, { status: 500 });
  }

  if (validatedPermissions) {
    const permissions = validatedPermissions;

    // Insert new permissions first (upsert), then remove stale ones.
    // This avoids the race where a concurrent auth check sees zero permissions
    // between a delete and insert.
    const { error: upsertError } = await admin.from("agent_permissions").upsert(
      permissions.map((permission) => ({
        agent_id: id,
        permission,
      })),
      { onConflict: "agent_id,permission" }
    );

    if (upsertError) {
      return NextResponse.json(
        { error: "Failed to update agent permissions" },
        { status: 500 }
      );
    }

    // Remove permissions that are no longer in the desired set
    const { error: deleteError } = await admin
      .from("agent_permissions")
      .delete()
      .eq("agent_id", id)
      .not("permission", "in", `(${permissions.map((p) => `"${p}"`).join(",")})`);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to clean up stale permissions" },
        { status: 500 }
      );
    }

    // Sync denormalized permissions on agent_keys
    await admin
      .from("agent_keys")
      .update({ permissions })
      .eq("agent_id", id);
  }

  return NextResponse.json({ success: true, id });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformAdmin();
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  const rateLimitedDel = await rateLimit(`admin:delete-agent:${auth.profile.id}`, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (rateLimitedDel) return rateLimitedDel;

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid agent ID" }, { status: 400 });
  }
  const admin = createAdminClient();

  const { data: deleted, error } = await admin
    .from("agents")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to delete commissioned agent" }, { status: 500 });
  }

  if (!deleted) {
    return NextResponse.json({ error: "Commissioned agent not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, id });
}
