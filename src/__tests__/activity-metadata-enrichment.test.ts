// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockInsert = vi.fn();
const mockAuthenticateAgent = vi.fn();
const mockRateLimit = vi.fn();

// Track all logAgentActivity calls
const activityInsertSpy = vi.fn();

/**
 * Recursive proxy that resolves any chained query builder calls.
 * The Supabase query builder can be:
 *   - called as a function (chaining methods return callables)
 *   - awaited directly (PostgREST builder is thenable)
 *   - terminated with .single() / .maybeSingle()
 */
function chainProxy(terminalResult: unknown): unknown {
  const handler: ProxyHandler<() => unknown> = {
    apply() {
      return new Proxy(() => terminalResult, handler);
    },
    get(_target, prop) {
      if (prop === "single" || prop === "maybeSingle") {
        return async () => terminalResult;
      }
      // Make the proxy thenable so `await supabase.from(...).update(...).eq(...)` resolves
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(terminalResult);
      }
      return new Proxy(() => terminalResult, handler);
    },
  };
  return new Proxy(() => terminalResult, handler);
}

const POST_ID = "00000000-0000-4000-a000-000000000001";
const POST_ROW = { id: POST_ID, status: "draft", organization_id: "org-1", user_id: "user-1" };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "agent_activity_log") {
        return {
          insert: (row: Record<string, unknown>) => {
            activityInsertSpy(row);
            return Promise.resolve({ error: null });
          },
        };
      }
      if (table === "posts") {
        return {
          insert: vi.fn(() => chainProxy({ data: POST_ROW, error: null })),
          select: vi.fn(() => chainProxy({ data: POST_ROW, error: null })),
          update: vi.fn(() => chainProxy({ data: POST_ROW, error: null })),
        };
      }
      if (table === "post_comments") {
        return {
          insert: vi.fn(() => chainProxy({
            data: { id: "comment-1", post_id: POST_ID, body: "test comment" },
            error: null,
          })),
        };
      }
      if (table === "review_events") {
        return {
          insert: vi.fn(async () => ({ error: null })),
        };
      }
      if (table === "users") {
        return {
          select: vi.fn(() => chainProxy({ data: { id: "user-1" }, error: null })),
        };
      }
      return { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
    }),
  })),
}));

vi.mock("@/lib/agent-auth", () => ({
  authenticateAgent: (...args: unknown[]) => mockAuthenticateAgent(...args),
  isAgentContext: (auth: unknown) => auth !== null && typeof auth === "object" && "agentId" in (auth as Record<string, unknown>),
  isSharedOrgAgentContext: () => false,
  hasAgentPermission: () => true,
  canAccessAgentUserRecord: () => true,
  getAgentRateLimitKey: (auth: { agentId: string }, action: string) => `agent:${auth.agentId}:${action}`,
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

vi.mock("@/lib/workflow", () => ({
  validateTransition: vi.fn(() => ({
    reviewAction: "escalated",
    updateFields: { status: "pending_review", updated_at: new Date().toISOString() },
  })),
  WorkflowError: class WorkflowError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.name = "WorkflowError";
      this.code = code;
    }
  },
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const AGENT_AUTH = {
  agentId: "agent-1",
  agentName: "scribe",
  userId: "user-1",
  organizationId: "org-1",
  permissions: ["drafts:read", "drafts:write", "comments:read", "comments:write", "reviews:write"],
  allowSharedContext: false,
};

function makeAgentRequest(
  url: string,
  opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
) {
  const { method = "POST", body, headers = {} } = opts;
  const reqHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: "Bearer gw_agent_testkey",
    ...headers,
  };
  return new NextRequest(new URL(url, "http://localhost"), {
    method,
    headers: reqHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Activity metadata enrichment (LIN-170)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockAuthenticateAgent.mockResolvedValue(AGENT_AUTH);
    mockRateLimit.mockResolvedValue(null);
  });

  /* ======== 1. X-Paperclip-Run-Id extracted and stored ======== */
  describe("provider_run_id extraction from X-Paperclip-Run-Id header", () => {
    it("POST /api/drafts stores provider_run_id in metadata", async () => {
      const { POST } = await import("@/app/api/drafts/route");

      const req = makeAgentRequest("http://localhost/api/drafts", {
        body: { content: "Draft content" },
        headers: { "x-paperclip-run-id": "run-abc-123" },
      });

      await POST(req);

      // Wait for fire-and-forget promise
      await new Promise((r) => setTimeout(r, 50));

      expect(activityInsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: "org-1",
          agent_id: "agent-1",
          action_type: "draft_created",
          metadata: expect.objectContaining({
            provider_run_id: "run-abc-123",
          }),
        })
      );
    });

    it("PATCH /api/drafts/[id] stores provider_run_id in metadata", async () => {
      const { PATCH } = await import("@/app/api/drafts/[id]/route");

      const req = makeAgentRequest(`http://localhost/api/drafts/${POST_ID}`, {
        method: "PATCH",
        body: { content: "Updated content" },
        headers: { "x-paperclip-run-id": "run-def-456" },
      });

      await PATCH(req, { params: Promise.resolve({ id: POST_ID }) });
      await new Promise((r) => setTimeout(r, 50));

      expect(activityInsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action_type: "draft_updated",
          metadata: expect.objectContaining({
            provider_run_id: "run-def-456",
          }),
        })
      );
    });

    it("POST /api/drafts/[id]/comments stores provider_run_id in metadata", async () => {
      const { POST } = await import("@/app/api/drafts/[id]/comments/route");

      const req = makeAgentRequest(`http://localhost/api/drafts/${POST_ID}/comments`, {
        body: { body: "Great draft!" },
        headers: { "x-paperclip-run-id": "run-ghi-789" },
      });

      await POST(req, { params: Promise.resolve({ id: POST_ID }) });
      await new Promise((r) => setTimeout(r, 50));

      expect(activityInsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action_type: "comment_added",
          metadata: expect.objectContaining({
            provider_run_id: "run-ghi-789",
          }),
        })
      );
    });

    it("POST /api/drafts/[id]/review stores provider_run_id in metadata", async () => {
      const { POST } = await import("@/app/api/drafts/[id]/review/route");

      const req = makeAgentRequest(`http://localhost/api/drafts/${POST_ID}/review`, {
        body: { action: "approved" },
        headers: { "x-paperclip-run-id": "run-jkl-012" },
      });

      await POST(req, { params: Promise.resolve({ id: POST_ID }) });
      await new Promise((r) => setTimeout(r, 50));

      expect(activityInsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action_type: "review_submitted",
          metadata: expect.objectContaining({
            provider_run_id: "run-jkl-012",
          }),
        })
      );
    });
  });

  /* ======== 2. Metadata merging ======== */
  describe("metadata merging", () => {
    it("merges route metadata and providerMetadata (not overwritten)", async () => {
      const { POST } = await import("@/app/api/drafts/route");

      const req = makeAgentRequest("http://localhost/api/drafts", {
        body: { content: "Draft", pillar_id: "00000000-0000-4000-a000-000000000099" },
        headers: { "x-paperclip-run-id": "run-merge-test" },
      });

      await POST(req);
      await new Promise((r) => setTimeout(r, 50));

      expect(activityInsertSpy).toHaveBeenCalledTimes(1);
      const insertedRow = activityInsertSpy.mock.calls[0][0];

      // Both route-specific metadata (content_type, pillar_id) and provider metadata (provider_run_id) present
      expect(insertedRow.metadata).toHaveProperty("content_type");
      expect(insertedRow.metadata).toHaveProperty("pillar_id");
      expect(insertedRow.metadata).toHaveProperty("provider_run_id", "run-merge-test");
    });
  });

  /* ======== 3. No header → no provider_run_id (no null pollution) ======== */
  describe("no null pollution", () => {
    it("POST /api/drafts without header does not include provider_run_id", async () => {
      const { POST } = await import("@/app/api/drafts/route");

      // No x-paperclip-run-id header
      const req = makeAgentRequest("http://localhost/api/drafts", {
        body: { content: "Draft without run ID" },
      });

      await POST(req);
      await new Promise((r) => setTimeout(r, 50));

      expect(activityInsertSpy).toHaveBeenCalledTimes(1);
      const insertedRow = activityInsertSpy.mock.calls[0][0];

      // Should have route metadata but NO provider_run_id key at all
      expect(insertedRow.metadata).not.toHaveProperty("provider_run_id");
      expect(insertedRow.metadata).toHaveProperty("content_type");
    });

    it("POST /api/drafts/[id]/review without header has no provider_run_id", async () => {
      const { POST } = await import("@/app/api/drafts/[id]/review/route");

      const req = makeAgentRequest(`http://localhost/api/drafts/${POST_ID}/review`, {
        body: { action: "approved" },
        // No x-paperclip-run-id header
      });

      await POST(req, { params: Promise.resolve({ id: POST_ID }) });
      await new Promise((r) => setTimeout(r, 50));

      const insertedRow = activityInsertSpy.mock.calls[0][0];
      expect(insertedRow.metadata).not.toHaveProperty("provider_run_id");
      expect(insertedRow.metadata).toHaveProperty("action", "approved");
    });
  });

  /* ======== 4. Activity logged for WorkflowError-rejected reviews ======== */
  describe("WorkflowError-rejected reviews still log activity", () => {
    it("logs activity even when validateTransition throws WorkflowError", async () => {
      // Make validateTransition throw WorkflowError
      const { WorkflowError } = await import("@/lib/workflow");
      const { validateTransition } = await import("@/lib/workflow");
      vi.mocked(validateTransition).mockImplementationOnce(() => {
        throw new WorkflowError("Invalid status transition", "INVALID_TRANSITION");
      });

      const { POST } = await import("@/app/api/drafts/[id]/review/route");

      const req = makeAgentRequest(`http://localhost/api/drafts/${POST_ID}/review`, {
        body: { action: "approved" },
        headers: { "x-paperclip-run-id": "run-workflow-error" },
      });

      const res = await POST(req, { params: Promise.resolve({ id: POST_ID }) });
      await new Promise((r) => setTimeout(r, 50));

      // Response should be 409 (WorkflowError)
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.code).toBe("INVALID_TRANSITION");

      // Activity should STILL be logged despite the error
      expect(activityInsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action_type: "review_submitted",
          metadata: expect.objectContaining({
            action: "approved",
            provider_run_id: "run-workflow-error",
          }),
        })
      );
    });
  });
});
