import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALL_AGENT_PERMISSIONS } from "@/lib/agent-permissions";
import { isAuthenticatedOrgUser, requirePlatformAdmin } from "@/lib/server-auth";

const UpdateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
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

  const { id } = await params;

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

  if (parsed.data.name) update.name = parsed.data.name.trim();
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

  if (parsed.data.permissions) {
    const permissions = Array.from(
      new Set(
        parsed.data.permissions.filter((permission) =>
          (ALL_AGENT_PERMISSIONS as readonly string[]).includes(permission)
        )
      )
    );

    if (permissions.length === 0) {
      return NextResponse.json(
        { error: "At least one valid permission is required." },
        { status: 400 }
      );
    }

    await admin.from("agent_permissions").delete().eq("agent_id", id);
    const { error: permissionError } = await admin.from("agent_permissions").insert(
      permissions.map((permission) => ({
        agent_id: id,
        permission,
      }))
    );

    if (permissionError) {
      return NextResponse.json(
        { error: "Failed to update agent permissions" },
        { status: 500 }
      );
    }

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

  const { id } = await params;
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
