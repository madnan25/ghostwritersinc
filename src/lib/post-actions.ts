export function isReviewQueueStatus(status: string): boolean {
  return status === "pending_review" || status === "agent_review";
}

export function getApproveActionLabel(status: string): string {
  if (status === "agent_review") {
    return "Approve for Review";
  }

  return "Approve";
}

export function canEditPost(status: string): boolean {
  return ["draft", "agent_review", "pending_review", "approved"].includes(status);
}

export function canRejectPost(status: string): boolean {
  return isReviewQueueStatus(status);
}
