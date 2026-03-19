import type { PostStatus, ReviewAction } from './types'

/**
 * Allowed status transitions for the multi-step approval workflow.
 *
 * Flow: draft → pending_review → approved/rejected → scheduled → published
 * Rejected posts can be revised back to draft.
 */
const ALLOWED_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  draft: ['pending_review'],
  pending_review: ['approved', 'rejected'],
  approved: ['scheduled', 'published', 'pending_review'],
  rejected: ['draft', 'pending_review'],
  scheduled: ['published', 'approved', 'publish_failed'],
  published: [],
  publish_failed: ['scheduled', 'draft'],
}

/** Maximum revision count before auto-rejection. */
export const REVISION_CAP = 3

export function isValidTransition(from: PostStatus, to: PostStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

export function getAllowedNextStatuses(current: PostStatus): PostStatus[] {
  return ALLOWED_TRANSITIONS[current] ?? []
}

export class WorkflowError extends Error {
  constructor(
    message: string,
    public readonly code: 'INVALID_TRANSITION' | 'REJECTION_REASON_REQUIRED'
  ) {
    super(message)
    this.name = 'WorkflowError'
  }
}

export interface TransitionInput {
  postId: string
  from: PostStatus
  to: PostStatus
  agentName: string
  notes?: string | null
  rejectionReason?: string | null
  /** When true, an agent "approve" keeps the post at pending_review (two-stage gate). */
  isAgentReview?: boolean
}

/**
 * Validates a status transition and returns the review action + fields to update.
 * Throws WorkflowError if the transition is invalid.
 */
export function validateTransition(input: TransitionInput): {
  reviewAction: ReviewAction
  updateFields: Record<string, unknown>
} {
  const { from, to, notes, rejectionReason, isAgentReview } = input

  if (!isValidTransition(from, to)) {
    throw new WorkflowError(
      `Invalid status transition from "${from}" to "${to}". Allowed: ${getAllowedNextStatuses(from).join(', ') || 'none'}`,
      'INVALID_TRANSITION'
    )
  }

  if (to === 'rejected' && !rejectionReason) {
    throw new WorkflowError(
      'Rejection requires a reason',
      'REJECTION_REASON_REQUIRED'
    )
  }

  const reviewAction: ReviewAction =
    to === 'rejected' ? 'rejected' :
    (from === 'rejected' && to === 'pending_review') ? 'revised' :
    (from === 'approved' && to === 'pending_review') ? 'escalated' :
    'approved'

  // Agent approvals keep the post at pending_review — only human
  // approvePost() moves it to approved (two-stage gate).
  const effectiveStatus: PostStatus =
    isAgentReview && to === 'approved' ? 'pending_review' : to

  const updateFields: Record<string, unknown> = {
    status: effectiveStatus,
    updated_at: new Date().toISOString(),
  }

  if (to === 'rejected') {
    updateFields.rejection_reason = rejectionReason
    // Only user rejections schedule deletion — agent rejections flag
    // quality issues and should not auto-delete.
    if (!isAgentReview) {
      updateFields.delete_scheduled_at = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ).toISOString()
    }
  }

  if (from === 'rejected' && (to === 'draft' || to === 'pending_review')) {
    updateFields.rejection_reason = null
    updateFields.delete_scheduled_at = null
  }

  // Clear reviewed_by_agent when a post re-enters pending_review
  // so the agent will pick it up for a fresh review cycle.
  if (to === 'pending_review' && (from === 'approved' || from === 'rejected' || from === 'draft')) {
    updateFields.reviewed_by_agent = null
  }

  if (notes) {
    updateFields.review_notes = notes
  }

  return { reviewAction, updateFields }
}
