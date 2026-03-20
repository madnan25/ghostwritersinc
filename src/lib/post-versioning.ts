import type { PostStatus } from './types'

interface BuildVersionedContentUpdateInput {
  status: PostStatus
  currentVersion: number
  updatedAt?: string
}

interface VersionedContentUpdatePlan {
  nextVersion: number
  updateFields: Record<string, unknown>
}

export function buildVersionedContentUpdate({
  status,
  currentVersion,
  updatedAt = new Date().toISOString(),
}: BuildVersionedContentUpdateInput): VersionedContentUpdatePlan {
  const nextVersion = currentVersion + 1
  const nextStatus: PostStatus = status === 'draft' ? 'draft' : 'pending_review'

  const updateFields: Record<string, unknown> = {
    status: nextStatus,
    content_version: nextVersion,
    updated_at: updatedAt,
  }

  if (nextStatus === 'pending_review') {
    updateFields.reviewed_by_agent = null
    updateFields.review_notes = null
    updateFields.rejection_reason = null
  }

  return { nextVersion, updateFields }
}
