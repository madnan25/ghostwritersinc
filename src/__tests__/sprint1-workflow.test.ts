// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
  isValidTransition,
  getAllowedNextStatuses,
  validateTransition,
  WorkflowError,
  REVISION_CAP,
} from '@/lib/workflow'
import type { PostStatus } from '@/lib/types'

describe('Sprint 1: workflow transitions', () => {
  describe('publish_failed transitions', () => {
    it('allows scheduled → publish_failed', () => {
      expect(isValidTransition('scheduled', 'publish_failed')).toBe(true)
    })

    it('allows publish_failed → scheduled', () => {
      expect(isValidTransition('publish_failed', 'scheduled')).toBe(true)
    })

    it('allows publish_failed → draft', () => {
      expect(isValidTransition('publish_failed', 'draft')).toBe(true)
    })

    it('disallows publish_failed → published (must reschedule first)', () => {
      expect(isValidTransition('publish_failed', 'published')).toBe(false)
    })

    it('disallows publish_failed → approved', () => {
      expect(isValidTransition('publish_failed', 'approved')).toBe(false)
    })

    it('disallows publish_failed → pending_review', () => {
      expect(isValidTransition('publish_failed', 'pending_review')).toBe(false)
    })

    it('disallows draft → publish_failed', () => {
      expect(isValidTransition('draft', 'publish_failed')).toBe(false)
    })

    it('disallows published → publish_failed', () => {
      expect(isValidTransition('published', 'publish_failed')).toBe(false)
    })

    it('includes publish_failed in allowed next statuses for scheduled', () => {
      const allowed = getAllowedNextStatuses('scheduled')
      expect(allowed).toContain('publish_failed')
      expect(allowed).toContain('published')
      expect(allowed).toContain('approved')
    })

    it('returns scheduled and draft as allowed from publish_failed', () => {
      const allowed = getAllowedNextStatuses('publish_failed')
      expect(allowed).toEqual(['scheduled', 'draft'])
    })
  })

  describe('existing transitions still work', () => {
    const validPairs: [PostStatus, PostStatus][] = [
      ['draft', 'pending_review'],
      ['pending_review', 'approved'],
      ['pending_review', 'rejected'],
      ['approved', 'scheduled'],
      ['approved', 'published'],
      ['approved', 'pending_review'],
      ['rejected', 'draft'],
      ['rejected', 'pending_review'],
      ['scheduled', 'published'],
      ['scheduled', 'approved'],
    ]

    for (const [from, to] of validPairs) {
      it(`allows ${from} → ${to}`, () => {
        expect(isValidTransition(from, to)).toBe(true)
      })
    }
  })

  describe('invalid transitions are blocked', () => {
    const invalidPairs: [PostStatus, PostStatus][] = [
      ['draft', 'approved'],
      ['draft', 'scheduled'],
      ['draft', 'published'],
      ['draft', 'rejected'],
      ['pending_review', 'draft'],
      ['pending_review', 'scheduled'],
      ['pending_review', 'published'],
      ['published', 'draft'],
      ['published', 'pending_review'],
      ['published', 'scheduled'],
      ['published', 'approved'],
      ['published', 'rejected'],
    ]

    for (const [from, to] of invalidPairs) {
      it(`blocks ${from} → ${to}`, () => {
        expect(isValidTransition(from, to)).toBe(false)
      })
    }
  })

  describe('validateTransition', () => {
    it('throws WorkflowError on invalid transition', () => {
      expect(() =>
        validateTransition({
          postId: 'test-id',
          from: 'draft',
          to: 'published',
          agentName: 'test-agent',
        })
      ).toThrow(WorkflowError)
    })

    it('throws WorkflowError with INVALID_TRANSITION code', () => {
      try {
        validateTransition({
          postId: 'test-id',
          from: 'draft',
          to: 'published',
          agentName: 'test-agent',
        })
        expect.unreachable('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(WorkflowError)
        expect((e as WorkflowError).code).toBe('INVALID_TRANSITION')
      }
    })

    it('throws REJECTION_REASON_REQUIRED when rejecting without reason', () => {
      try {
        validateTransition({
          postId: 'test-id',
          from: 'pending_review',
          to: 'rejected',
          agentName: 'test-agent',
        })
        expect.unreachable('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(WorkflowError)
        expect((e as WorkflowError).code).toBe('REJECTION_REASON_REQUIRED')
      }
    })

    it('allows rejection with a reason', () => {
      const result = validateTransition({
        postId: 'test-id',
        from: 'pending_review',
        to: 'rejected',
        agentName: 'test-agent',
        rejectionReason: 'Quality too low',
      })
      expect(result.reviewAction).toBe('rejected')
      expect(result.updateFields.status).toBe('rejected')
      expect(result.updateFields.rejection_reason).toBe('Quality too low')
    })

    it('validates scheduled → publish_failed transition', () => {
      const result = validateTransition({
        postId: 'test-id',
        from: 'scheduled',
        to: 'publish_failed',
        agentName: 'test-agent',
        notes: 'LinkedIn API error',
      })
      expect(result.reviewAction).toBe('approved')
      expect(result.updateFields.status).toBe('publish_failed')
      expect(result.updateFields.review_notes).toBe('LinkedIn API error')
    })

    it('validates publish_failed → scheduled transition', () => {
      const result = validateTransition({
        postId: 'test-id',
        from: 'publish_failed',
        to: 'scheduled',
        agentName: 'test-agent',
      })
      expect(result.updateFields.status).toBe('scheduled')
    })

    it('validates publish_failed → draft transition', () => {
      const result = validateTransition({
        postId: 'test-id',
        from: 'publish_failed',
        to: 'draft',
        agentName: 'test-agent',
      })
      expect(result.updateFields.status).toBe('draft')
    })

    it('agent approval keeps post at pending_review (two-stage gate)', () => {
      const result = validateTransition({
        postId: 'test-id',
        from: 'pending_review',
        to: 'approved',
        agentName: 'test-agent',
        isAgentReview: true,
      })
      expect(result.updateFields.status).toBe('pending_review')
    })

    it('human approval moves post to approved', () => {
      const result = validateTransition({
        postId: 'test-id',
        from: 'pending_review',
        to: 'approved',
        agentName: 'test-agent',
        isAgentReview: false,
      })
      expect(result.updateFields.status).toBe('approved')
    })

    it('clears rejection fields when reverting rejected → draft', () => {
      const result = validateTransition({
        postId: 'test-id',
        from: 'rejected',
        to: 'draft',
        agentName: 'test-agent',
      })
      expect(result.updateFields.rejection_reason).toBeNull()
      expect(result.updateFields.delete_scheduled_at).toBeNull()
    })

    it('clears rejection fields when reverting rejected → pending_review', () => {
      const result = validateTransition({
        postId: 'test-id',
        from: 'rejected',
        to: 'pending_review',
        agentName: 'test-agent',
      })
      expect(result.reviewAction).toBe('revised')
      expect(result.updateFields.rejection_reason).toBeNull()
      expect(result.updateFields.delete_scheduled_at).toBeNull()
      expect(result.updateFields.reviewed_by_agent).toBeNull()
    })

    it('clears reviewed_by_agent when re-entering pending_review from draft', () => {
      const result = validateTransition({
        postId: 'test-id',
        from: 'draft',
        to: 'pending_review',
        agentName: 'test-agent',
      })
      expect(result.updateFields.reviewed_by_agent).toBeNull()
    })

    it('clears reviewed_by_agent when re-entering pending_review from approved', () => {
      const result = validateTransition({
        postId: 'test-id',
        from: 'approved',
        to: 'pending_review',
        agentName: 'test-agent',
      })
      expect(result.reviewAction).toBe('escalated')
      expect(result.updateFields.reviewed_by_agent).toBeNull()
    })

    it('sets delete_scheduled_at on user rejection (not agent)', () => {
      const result = validateTransition({
        postId: 'test-id',
        from: 'pending_review',
        to: 'rejected',
        agentName: 'test-agent',
        rejectionReason: 'Off-brand content',
        isAgentReview: false,
      })
      expect(result.updateFields.delete_scheduled_at).toBeDefined()
    })

    it('does NOT set delete_scheduled_at on agent rejection', () => {
      const result = validateTransition({
        postId: 'test-id',
        from: 'pending_review',
        to: 'rejected',
        agentName: 'test-agent',
        rejectionReason: 'Quality issue',
        isAgentReview: true,
      })
      expect(result.updateFields.delete_scheduled_at).toBeUndefined()
    })
  })

  describe('REVISION_CAP constant', () => {
    it('is set to 3', () => {
      expect(REVISION_CAP).toBe(3)
    })
  })
})

describe('Sprint 1: PostStatus type coverage', () => {
  it('publish_failed is a valid PostStatus value', () => {
    const status: PostStatus = 'publish_failed'
    expect(status).toBe('publish_failed')
  })

  it('getAllowedNextStatuses handles all 7 statuses without error', () => {
    const allStatuses: PostStatus[] = [
      'draft',
      'pending_review',
      'approved',
      'rejected',
      'scheduled',
      'published',
      'publish_failed',
    ]
    for (const s of allStatuses) {
      expect(() => getAllowedNextStatuses(s)).not.toThrow()
      expect(Array.isArray(getAllowedNextStatuses(s))).toBe(true)
    }
  })

  it('published is a terminal state', () => {
    expect(getAllowedNextStatuses('published')).toEqual([])
  })
})
