// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { buildVersionedContentUpdate } from '@/lib/post-versioning'

describe('post versioning', () => {
  it('keeps draft edits in draft while bumping the content version', () => {
    const result = buildVersionedContentUpdate({
      status: 'draft',
      currentVersion: 1,
      updatedAt: '2026-03-20T00:00:00Z',
    })

    expect(result.nextVersion).toBe(2)
    expect(result.updateFields).toMatchObject({
      status: 'draft',
      content_version: 2,
      updated_at: '2026-03-20T00:00:00Z',
    })
  })

  it('moves reviewed versions back to pending_review and clears stale review state', () => {
    const result = buildVersionedContentUpdate({
      status: 'approved',
      currentVersion: 2,
      updatedAt: '2026-03-20T00:00:00Z',
    })

    expect(result.nextVersion).toBe(3)
    expect(result.updateFields).toMatchObject({
      status: 'pending_review',
      content_version: 3,
      reviewed_by_agent: null,
      review_notes: null,
      rejection_reason: null,
      updated_at: '2026-03-20T00:00:00Z',
    })
  })

  it('moves rejected versions back to pending_review', () => {
    const result = buildVersionedContentUpdate({
      status: 'rejected',
      currentVersion: 4,
      updatedAt: '2026-03-20T00:00:00Z',
    })

    expect(result.updateFields).toMatchObject({
      status: 'pending_review',
      content_version: 5,
      rejection_reason: null,
    })
  })
})
