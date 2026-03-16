import type { PostStatus, ReviewAction } from './types'

/**
 * Allowed status transitions for the multi-step approval workflow.
 *
 * Flow: draft → agent_review → pending_review → approved/rejected → scheduled → published
 * Rejected posts can be revised back to draft.
 */
const ALLOWED_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  draft: ['agent_review'],
  agent_review: ['pending_review', 'rejected'],
  pending_review: ['approved', 'rejected'],
  approved: ['scheduled', 'published'],
  rejected: ['draft'],
  scheduled: ['published'],
  published: [],
}

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
}

/**
 * Validates a status transition and returns the review action + fields to update.
 * Throws WorkflowError if the transition is invalid.
 */
export function validateTransition(input: TransitionInput): {
  reviewAction: ReviewAction
  updateFields: Record<string, unknown>
} {
  const { from, to, notes, rejectionReason } = input

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
    to === 'pending_review' ? 'escalated' :
    'approved'

  const updateFields: Record<string, unknown> = {
    status: to,
    updated_at: new Date().toISOString(),
  }

  if (to === 'rejected') {
    updateFields.rejection_reason = rejectionReason
  }

  if (to === 'draft' && from === 'rejected') {
    updateFields.rejection_reason = null
  }

  if (notes) {
    updateFields.review_notes = notes
  }

  return { reviewAction, updateFields }
}
