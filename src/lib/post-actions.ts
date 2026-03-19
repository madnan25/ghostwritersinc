export function isReviewQueueStatus(status: string): boolean {
  return status === "pending_review";
}

export function getApproveActionLabel(): string {
  return "Approve";
}

export function canEditPost(status: string): boolean {
  return ["draft", "pending_review", "approved"].includes(status);
}

export function canRejectPost(status: string): boolean {
  return isReviewQueueStatus(status);
}
