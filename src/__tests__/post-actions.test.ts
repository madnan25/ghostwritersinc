// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  canEditPost,
  canRejectPost,
  getApproveActionLabel,
  isReviewQueueStatus,
} from "@/lib/post-actions";

describe("post action helpers", () => {
  it("treats pending_review as the only review queue status", () => {
    expect(isReviewQueueStatus("pending_review")).toBe(true);
    expect(isReviewQueueStatus("draft")).toBe(false);
    expect(isReviewQueueStatus("approved")).toBe(false);
  });

  it("returns Approve as the approval label", () => {
    expect(getApproveActionLabel()).toBe("Approve");
  });

  it("allows editing and rejection only in supported statuses", () => {
    expect(canEditPost("draft")).toBe(true);
    expect(canEditPost("pending_review")).toBe(true);
    expect(canEditPost("published")).toBe(false);
    expect(canRejectPost("pending_review")).toBe(true);
    expect(canRejectPost("approved")).toBe(false);
  });
});
