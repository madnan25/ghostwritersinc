import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AgentFulfillmentError,
  issueAgentKeyForAgent,
} from "@/lib/agent-fulfillment";
import { isAuthenticatedOrgUser, requirePlatformAdmin } from "@/lib/server-auth";
import { rateLimit } from "@/lib/rate-limit";

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
