// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
  canEditPost,
  canRejectPost,
  isReviewQueueStatus,
} from '@/lib/post-actions'

describe('Sprint 1: post-actions with publish_failed status', () => {
  it('publish_failed is NOT a review queue status', () => {
    expect(isReviewQueueStatus('publish_failed')).toBe(false)
  })

  it('publish_failed posts cannot be edited via canEditPost', () => {
    expect(canEditPost('publish_failed')).toBe(false)
  })

  it('publish_failed posts cannot be rejected', () => {
    expect(canRejectPost('publish_failed')).toBe(false)
  })

  it('scheduled posts cannot be edited', () => {
    expect(canEditPost('scheduled')).toBe(false)
  })

  it('rejected posts cannot be edited via canEditPost', () => {
    expect(canEditPost('rejected')).toBe(false)
  })
})
