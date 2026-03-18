// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  canEditPost,
  canRejectPost,
  getApproveActionLabel,
  isReviewQueueStatus,
} from "@/lib/post-actions";

describe("post action helpers", () => {
  it("treats both review statuses as review queue items", () => {
    expect(isReviewQueueStatus("agent_review")).toBe(true);
    expect(isReviewQueueStatus("pending_review")).toBe(true);
    expect(isReviewQueueStatus("draft")).toBe(false);
  });

  it("returns the correct approval label", () => {
    expect(getApproveActionLabel("agent_review")).toBe("Approve for Review");
    expect(getApproveActionLabel("pending_review")).toBe("Approve");
  });

  it("allows editing and rejection only in supported statuses", () => {
    expect(canEditPost("draft")).toBe(true);
    expect(canEditPost("pending_review")).toBe(true);
    expect(canEditPost("published")).toBe(false);
    expect(canRejectPost("agent_review")).toBe(true);
    expect(canRejectPost("approved")).toBe(false);
  });
});
