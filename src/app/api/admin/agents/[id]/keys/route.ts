import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AgentFulfillmentError,
  issueAgentKeyForAgent,
} from "@/lib/agent-fulfillment";
import { isAuthenticatedOrgUser, requirePlatformAdmin } from "@/lib/server-auth";
import { rateLimit } from "@/lib/rate-limit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformAdmin();
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  const rateLimited = await rateLimit(`admin:issue-key:${auth.profile.id}`, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid agent ID" }, { status: 400 });
  }
  const admin = createAdminClient();
  try {
    const result = await issueAgentKeyForAgent({
      admin,
      agentId: id,
      commissionedByUserId: auth.profile.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AgentFulfillmentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Failed to create agent key" }, { status: 500 });
  }
}
