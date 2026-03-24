// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
  isValidTransition,
  getAllowedNextStatuses,
  validateTransition,
  WorkflowError,
  REVISION_CAP,
} from '@/lib/workflow'
import { buildVersionedContentUpdate } from '@/lib/post-versioning'
import type { PostStatus, ReviewAction } from '@/lib/types'

// ---------------------------------------------------------------------------
// Sprint 6 QA — E2E integration testing (LIN-340)
// All 3 workflow paths + publisher tests + regression
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Path 1: Happy path
// research → brief → draft → agent review → human approve → schedule → publish
// ---------------------------------------------------------------------------

describe('Path 1: Happy path (full lifecycle)', () => {
  it('draft → pending_review is valid (submit for review)', () => {
    expect(isValidTransition('draft', 'pending_review')).toBe(true)
  })

  it('draft creation sets status to pending_review', () => {
    // Drafts created via POST /api/drafts are inserted with status: 'pending_review'
    // This simulates that behavior at the workflow level
    const result = validateTransition({
      postId: 'happy-path-post',
      from: 'draft',
      to: 'pending_review',
      agentName: 'scribe',
    })
    expect(result.updateFields.status).toBe('pending_review')
    expect(result.reviewAction).toBe('escalated')
    expect(result.updateFields.reviewed_by_agent).toBeNull()
  })

  it('agent approval keeps post at pending_review (two-stage gate)', () => {
    const result = validateTransition({
      postId: 'happy-path-post',
      from: 'pending_review',
      to: 'approved',
      agentName: 'strategist',
      isAgentReview: true,
      notes: 'Content is on-brand and well-structured',
    })
    // Agent approval should NOT move to approved — stays at pending_review
    expect(result.updateFields.status).toBe('pending_review')
    expect(result.reviewAction).toBe('approved')
  })

  it('human approval moves post to approved', () => {
    const result = validateTransition({
      postId: 'happy-path-post',
      from: 'pending_review',
      to: 'approved',
      agentName: 'client',
      isAgentReview: false,
    })
    expect(result.updateFields.status).toBe('approved')
    expect(result.reviewAction).toBe('approved')
  })

  it('approved → scheduled is valid', () => {
    const result = validateTransition({
      postId: 'happy-path-post',
      from: 'approved',
      to: 'scheduled',
      agentName: 'client',
      notes: 'Scheduled for 2026-04-01T09:00:00Z',
    })
    expect(result.updateFields.status).toBe('scheduled')
    expect(result.reviewAction).toBe('approved')
    expect(result.updateFields.review_notes).toBe('Scheduled for 2026-04-01T09:00:00Z')
  })

  it('scheduled → published is valid (final step)', () => {
    const result = validateTransition({
      postId: 'happy-path-post',
      from: 'scheduled',
      to: 'published',
      agentName: 'system',
      notes: 'Published to LinkedIn (urn:li:share:123456)',
    })
    expect(result.updateFields.status).toBe('published')
    expect(result.reviewAction).toBe('approved')
  })

  it('published is terminal — no further transitions', () => {
    const allowed = getAllowedNextStatuses('published')
    expect(allowed).toEqual([])
  })

  it('validates the complete happy path end-to-end', () => {
    const transitions: { from: PostStatus; to: PostStatus; agentName: string; isAgentReview?: boolean; notes?: string }[] = [
      { from: 'draft', to: 'pending_review', agentName: 'scribe' },
      { from: 'pending_review', to: 'approved', agentName: 'strategist', isAgentReview: true },
      // After agent approval, status stays at pending_review, so human approves from pending_review
      { from: 'pending_review', to: 'approved', agentName: 'client', isAgentReview: false },
      { from: 'approved', to: 'scheduled', agentName: 'client', notes: 'Scheduled for April 1' },
      { from: 'scheduled', to: 'published', agentName: 'system' },
    ]

    let currentStatus: PostStatus = 'draft'
    for (const t of transitions) {
      expect(t.from).toBe(currentStatus)
      const result = validateTransition({
        postId: 'e2e-happy-path',
        from: t.from,
        to: t.to,
        agentName: t.agentName,
        isAgentReview: t.isAgentReview,
        notes: t.notes,
      })
      currentStatus = result.updateFields.status as PostStatus
    }
    expect(currentStatus).toBe('published')
  })
})

// ---------------------------------------------------------------------------
// Path 2: Failure path
// brief → draft → 3 rejections → park → human reopen → approve → publish
// ---------------------------------------------------------------------------

describe('Path 2: Failure path (3 rejections → reopen → publish)', () => {
  it('agent rejection moves to revision status (not rejected)', () => {
    // Agent review uses 'revision' target, not 'rejected'
    const result = validateTransition({
      postId: 'failure-path-post',
      from: 'pending_review',
      to: 'revision',
      agentName: 'strategist',
      isAgentReview: true,
      rejectionReason: 'Hook needs work',
    })
    expect(result.updateFields.status).toBe('revision')
    expect(result.updateFields.rejection_reason).toBe('Hook needs work')
    expect(result.reviewAction).toBe('revised')
  })

  it('agent rejection does NOT schedule deletion', () => {
    const result = validateTransition({
      postId: 'failure-path-post',
      from: 'pending_review',
      to: 'revision',
      agentName: 'strategist',
      isAgentReview: true,
      rejectionReason: 'Off-topic',
    })
    expect(result.updateFields.delete_scheduled_at).toBeUndefined()
  })

  it('revision → pending_review is valid (resubmit after revision)', () => {
    const result = validateTransition({
      postId: 'failure-path-post',
      from: 'revision',
      to: 'pending_review',
      agentName: 'scribe',
    })
    expect(result.updateFields.status).toBe('pending_review')
    expect(result.updateFields.reviewed_by_agent).toBeNull()
    expect(result.reviewAction).toBe('revised')
  })

  it('human rejection moves to rejected and schedules 24h deletion', () => {
    const before = Date.now()
    const result = validateTransition({
      postId: 'failure-path-post',
      from: 'pending_review',
      to: 'rejected',
      agentName: 'client',
      isAgentReview: false,
      rejectionReason: 'Not aligned with brand voice',
    })
    expect(result.updateFields.status).toBe('rejected')
    expect(result.updateFields.rejection_reason).toBe('Not aligned with brand voice')

    const deleteAt = new Date(result.updateFields.delete_scheduled_at as string).getTime()
    const after = Date.now()
    expect(deleteAt).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000 - 1000)
    expect(deleteAt).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000 + 1000)
  })

  it('rejection without reason throws REJECTION_REASON_REQUIRED', () => {
    try {
      validateTransition({
        postId: 'failure-path-post',
        from: 'pending_review',
        to: 'rejected',
        agentName: 'client',
      })
      expect.unreachable('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(WorkflowError)
      expect((e as WorkflowError).code).toBe('REJECTION_REASON_REQUIRED')
    }
  })

  it('content version increments through 3 rejection cycles', () => {
    let version = 1
    const statuses: PostStatus[] = ['pending_review', 'rejected', 'rejected']

    for (const status of statuses) {
      const { nextVersion } = buildVersionedContentUpdate({
        status,
        currentVersion: version,
      })
      version = nextVersion
    }
    // 1 → 2 → 3 → 4 after 3 revisions
    expect(version).toBe(4)
  })

  it('REVISION_CAP is 3', () => {
    expect(REVISION_CAP).toBe(3)
  })

  it('reopen dialog shown when revisionCount >= REVISION_CAP', () => {
    // Simulates the UI condition in PostDetailActions
    expect(3 >= REVISION_CAP).toBe(true)
    expect(2 >= REVISION_CAP).toBe(false)
    expect(4 >= REVISION_CAP).toBe(true)
  })

  it('reopening a rejected post clears rejection state and resets to pending_review', () => {
    const result = validateTransition({
      postId: 'failure-path-post',
      from: 'rejected',
      to: 'pending_review',
      agentName: 'client',
      notes: 'Reopened after 3 revision cycles: Try a completely different angle',
    })
    expect(result.updateFields.status).toBe('pending_review')
    expect(result.updateFields.rejection_reason).toBeNull()
    expect(result.updateFields.delete_scheduled_at).toBeNull()
    expect(result.updateFields.reviewed_by_agent).toBeNull()
    expect(result.reviewAction).toBe('revised')
  })

  it('validates the complete failure → recovery path end-to-end', () => {
    // Simulate: draft → pending_review → revision (agent reject) → pending_review
    //   → rejected (human reject #1) → pending_review → rejected (human reject #2)
    //   → pending_review → rejected (human reject #3 — cap reached)
    //   → reopen → pending_review → agent approve → human approve → scheduled → published

    const transitions: {
      from: PostStatus
      to: PostStatus
      agentName: string
      isAgentReview?: boolean
      rejectionReason?: string
      notes?: string
    }[] = [
      // Initial submission
      { from: 'draft', to: 'pending_review', agentName: 'scribe' },
      // Agent rejection → revision
      { from: 'pending_review', to: 'revision', agentName: 'strategist', isAgentReview: true, rejectionReason: 'Weak hook' },
      // Resubmit after revision
      { from: 'revision', to: 'pending_review', agentName: 'scribe' },
      // Human rejection #1
      { from: 'pending_review', to: 'rejected', agentName: 'client', rejectionReason: 'Not compelling' },
      // Revise and resubmit
      { from: 'rejected', to: 'pending_review', agentName: 'client' },
      // Human rejection #2
      { from: 'pending_review', to: 'rejected', agentName: 'client', rejectionReason: 'Still off-brand' },
      // Revise and resubmit
      { from: 'rejected', to: 'pending_review', agentName: 'client' },
      // Human rejection #3 — cap reached, post is parked
      { from: 'pending_review', to: 'rejected', agentName: 'client', rejectionReason: 'Third rejection — parking' },
      // Human reopens after cap (reset version to 1 in real code)
      { from: 'rejected', to: 'pending_review', agentName: 'client', notes: 'Reopened: fresh angle' },
      // Agent approves (stays at pending_review)
      { from: 'pending_review', to: 'approved', agentName: 'strategist', isAgentReview: true },
      // Human approves
      { from: 'pending_review', to: 'approved', agentName: 'client', isAgentReview: false },
      // Schedule
      { from: 'approved', to: 'scheduled', agentName: 'client', notes: 'Scheduled for April 15' },
      // Publish
      { from: 'scheduled', to: 'published', agentName: 'system' },
    ]

    let currentStatus: PostStatus = 'draft'
    for (const t of transitions) {
      expect(t.from).toBe(currentStatus)
      const result = validateTransition({
        postId: 'e2e-failure-path',
        from: t.from,
        to: t.to,
        agentName: t.agentName,
        isAgentReview: t.isAgentReview,
        rejectionReason: t.rejectionReason,
        notes: t.notes,
      })
      currentStatus = result.updateFields.status as PostStatus
    }
    expect(currentStatus).toBe('published')
  })
})

// ---------------------------------------------------------------------------
// Path 3: Unscheduled path
// brief (no date) → draft → approve → human assigns date → publish
// ---------------------------------------------------------------------------

describe('Path 3: Unscheduled path (no date → manual schedule)', () => {
  it('human approval without suggested_publish_at stays at approved (no auto-schedule)', () => {
    // When approvePost() is called and post has no suggested_publish_at,
    // it only calls transitionPostStatus(postId, 'approved', 'client')
    const result = validateTransition({
      postId: 'unscheduled-path-post',
      from: 'pending_review',
      to: 'approved',
      agentName: 'client',
      isAgentReview: false,
    })
    expect(result.updateFields.status).toBe('approved')
    // No scheduled_publish_at set in updateFields
    expect(result.updateFields.scheduled_publish_at).toBeUndefined()
  })

  it('approved → scheduled is valid (human manually schedules later)', () => {
    const result = validateTransition({
      postId: 'unscheduled-path-post',
      from: 'approved',
      to: 'scheduled',
      agentName: 'client',
      notes: 'Scheduled for 2026-04-10T14:00:00Z',
    })
    expect(result.updateFields.status).toBe('scheduled')
  })

  it('validates the complete unscheduled path end-to-end', () => {
    const transitions: {
      from: PostStatus
      to: PostStatus
      agentName: string
      isAgentReview?: boolean
      notes?: string
    }[] = [
      // Create draft (no suggested_publish_at)
      { from: 'draft', to: 'pending_review', agentName: 'scribe' },
      // Agent approves
      { from: 'pending_review', to: 'approved', agentName: 'strategist', isAgentReview: true },
      // Human approves (no auto-schedule since no suggested_publish_at)
      { from: 'pending_review', to: 'approved', agentName: 'client', isAgentReview: false },
      // Human manually schedules
      { from: 'approved', to: 'scheduled', agentName: 'client', notes: 'Manually scheduled' },
      // Publish
      { from: 'scheduled', to: 'published', agentName: 'system' },
    ]

    let currentStatus: PostStatus = 'draft'
    for (const t of transitions) {
      expect(t.from).toBe(currentStatus)
      const result = validateTransition({
        postId: 'e2e-unscheduled-path',
        from: t.from,
        to: t.to,
        agentName: t.agentName,
        isAgentReview: t.isAgentReview,
        notes: t.notes,
      })
      currentStatus = result.updateFields.status as PostStatus
    }
    expect(currentStatus).toBe('published')
  })

  it('approved posts can be rescheduled (cancel → reschedule)', () => {
    // Cancel: scheduled → approved
    const cancel = validateTransition({
      postId: 'unscheduled-path-post',
      from: 'scheduled',
      to: 'approved',
      agentName: 'client',
      notes: 'Cancelled schedule',
    })
    expect(cancel.updateFields.status).toBe('approved')

    // Reschedule: approved → scheduled
    const reschedule = validateTransition({
      postId: 'unscheduled-path-post',
      from: 'approved',
      to: 'scheduled',
      agentName: 'client',
      notes: 'Rescheduled for new date',
    })
    expect(reschedule.updateFields.status).toBe('scheduled')
  })
})

// ---------------------------------------------------------------------------
// Publisher tests: publish_failed status and failure handling
// ---------------------------------------------------------------------------

describe('Publisher: failure injection and publish_failed handling', () => {
  it('scheduled → publish_failed is valid (simulates 429/500)', () => {
    expect(isValidTransition('scheduled', 'publish_failed')).toBe(true)
    const result = validateTransition({
      postId: 'publish-fail-post',
      from: 'scheduled',
      to: 'publish_failed',
      agentName: 'system',
      notes: 'LinkedIn API returned 429: rate limit exceeded',
    })
    expect(result.updateFields.status).toBe('publish_failed')
    expect(result.updateFields.review_notes).toBe('LinkedIn API returned 429: rate limit exceeded')
  })

  it('publish_failed → scheduled is valid (retry)', () => {
    expect(isValidTransition('publish_failed', 'scheduled')).toBe(true)
    const result = validateTransition({
      postId: 'publish-fail-post',
      from: 'publish_failed',
      to: 'scheduled',
      agentName: 'system',
      notes: 'Retry scheduled after backoff',
    })
    expect(result.updateFields.status).toBe('scheduled')
  })

  it('publish_failed → draft is valid (return to editing)', () => {
    expect(isValidTransition('publish_failed', 'draft')).toBe(true)
  })

  it('publish_failed → pending_review is valid (re-review after failure)', () => {
    expect(isValidTransition('publish_failed', 'pending_review')).toBe(true)
    const result = validateTransition({
      postId: 'publish-fail-post',
      from: 'publish_failed',
      to: 'pending_review',
      agentName: 'system',
    })
    expect(result.updateFields.reviewed_by_agent).toBeNull()
  })

  it('publish_failed cannot go directly to published (must reschedule)', () => {
    expect(isValidTransition('publish_failed', 'published')).toBe(false)
  })

  it('publish_failed → rejected is invalid', () => {
    expect(isValidTransition('publish_failed', 'rejected')).toBe(false)
  })

  it('validates failure → retry → publish recovery path', () => {
    const transitions: { from: PostStatus; to: PostStatus; agentName: string; notes?: string }[] = [
      { from: 'scheduled', to: 'publish_failed', agentName: 'system', notes: 'LinkedIn 500 error' },
      { from: 'publish_failed', to: 'scheduled', agentName: 'system', notes: 'Retry after backoff' },
      { from: 'scheduled', to: 'published', agentName: 'system', notes: 'Published successfully on retry' },
    ]

    let currentStatus: PostStatus = 'scheduled'
    for (const t of transitions) {
      expect(t.from).toBe(currentStatus)
      const result = validateTransition({
        postId: 'e2e-publish-retry',
        from: t.from,
        to: t.to,
        agentName: t.agentName,
        notes: t.notes,
      })
      currentStatus = result.updateFields.status as PostStatus
    }
    expect(currentStatus).toBe('published')
  })

  it('validates failure → re-review → schedule → publish recovery path', () => {
    const transitions: { from: PostStatus; to: PostStatus; agentName: string; notes?: string; isAgentReview?: boolean }[] = [
      { from: 'scheduled', to: 'publish_failed', agentName: 'system', notes: 'LinkedIn 429 rate limit' },
      { from: 'publish_failed', to: 'pending_review', agentName: 'system', notes: 'Sent back for review after failure' },
      { from: 'pending_review', to: 'approved', agentName: 'strategist', isAgentReview: true },
      { from: 'pending_review', to: 'approved', agentName: 'client', isAgentReview: false },
      { from: 'approved', to: 'scheduled', agentName: 'client', notes: 'Rescheduled' },
      { from: 'scheduled', to: 'published', agentName: 'system' },
    ]

    let currentStatus: PostStatus = 'scheduled'
    for (const t of transitions) {
      expect(t.from).toBe(currentStatus)
      const result = validateTransition({
        postId: 'e2e-publish-rereview',
        from: t.from,
        to: t.to,
        agentName: t.agentName,
        isAgentReview: t.isAgentReview,
        notes: t.notes,
      })
      currentStatus = result.updateFields.status as PostStatus
    }
    expect(currentStatus).toBe('published')
  })
})

// ---------------------------------------------------------------------------
// Content versioning through workflow transitions
// ---------------------------------------------------------------------------

describe('Content versioning across workflow paths', () => {
  it('draft edit stays in draft', () => {
    const { nextVersion, updateFields } = buildVersionedContentUpdate({
      status: 'draft',
      currentVersion: 1,
    })
    expect(nextVersion).toBe(2)
    expect(updateFields.status).toBe('draft')
  })

  it('pending_review edit reverts to pending_review with cleared agent review', () => {
    const { nextVersion, updateFields } = buildVersionedContentUpdate({
      status: 'pending_review',
      currentVersion: 1,
    })
    expect(nextVersion).toBe(2)
    expect(updateFields.status).toBe('pending_review')
    expect(updateFields.reviewed_by_agent).toBeNull()
    expect(updateFields.review_notes).toBeNull()
    expect(updateFields.rejection_reason).toBeNull()
  })

  it('approved edit reverts to pending_review', () => {
    const { nextVersion, updateFields } = buildVersionedContentUpdate({
      status: 'approved',
      currentVersion: 2,
    })
    expect(nextVersion).toBe(3)
    expect(updateFields.status).toBe('pending_review')
  })

  it('scheduled edit reverts to pending_review', () => {
    const { nextVersion, updateFields } = buildVersionedContentUpdate({
      status: 'scheduled',
      currentVersion: 3,
    })
    expect(nextVersion).toBe(4)
    expect(updateFields.status).toBe('pending_review')
  })

  it('rejected edit reverts to pending_review and clears rejection state', () => {
    const { updateFields } = buildVersionedContentUpdate({
      status: 'rejected',
      currentVersion: 2,
    })
    expect(updateFields.status).toBe('pending_review')
    expect(updateFields.rejection_reason).toBeNull()
    expect(updateFields.reviewed_by_agent).toBeNull()
  })

  it('publish_failed edit reverts to pending_review', () => {
    const { nextVersion, updateFields } = buildVersionedContentUpdate({
      status: 'publish_failed',
      currentVersion: 3,
    })
    expect(nextVersion).toBe(4)
    expect(updateFields.status).toBe('pending_review')
  })
})

// ---------------------------------------------------------------------------
// Regression: Invalid transitions are blocked
// ---------------------------------------------------------------------------

describe('Regression: invalid transitions are blocked', () => {
  it('draft cannot skip to approved', () => {
    expect(isValidTransition('draft', 'approved')).toBe(false)
  })

  it('draft cannot skip to scheduled', () => {
    expect(isValidTransition('draft', 'scheduled')).toBe(false)
  })

  it('draft cannot skip to published', () => {
    expect(isValidTransition('draft', 'published')).toBe(false)
  })

  it('pending_review cannot skip to scheduled', () => {
    expect(isValidTransition('pending_review', 'scheduled')).toBe(false)
  })

  it('pending_review cannot skip to published', () => {
    expect(isValidTransition('pending_review', 'published')).toBe(false)
  })

  it('rejected cannot go to approved directly', () => {
    expect(isValidTransition('rejected', 'approved')).toBe(false)
  })

  it('rejected cannot go to scheduled directly', () => {
    expect(isValidTransition('rejected', 'scheduled')).toBe(false)
  })

  it('revision cannot go to approved directly', () => {
    expect(isValidTransition('revision', 'approved')).toBe(false)
  })

  it('published has no allowed transitions (terminal state)', () => {
    const targets: PostStatus[] = [
      'draft', 'pending_review', 'approved', 'rejected',
      'revision', 'scheduled', 'publish_failed',
    ]
    for (const to of targets) {
      expect(isValidTransition('published', to)).toBe(false)
    }
  })

  it('invalid transition throws WorkflowError with INVALID_TRANSITION code', () => {
    try {
      validateTransition({
        postId: 'regression-post',
        from: 'draft',
        to: 'published',
        agentName: 'system',
      })
      expect.unreachable('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(WorkflowError)
      expect((e as WorkflowError).code).toBe('INVALID_TRANSITION')
    }
  })
})

// ---------------------------------------------------------------------------
// Regression: Two-stage gate consistency
// ---------------------------------------------------------------------------

describe('Regression: two-stage gate (agent vs human approval)', () => {
  it('agent approval on any post keeps it at pending_review', () => {
    const result = validateTransition({
      postId: 'gate-test',
      from: 'pending_review',
      to: 'approved',
      agentName: 'strategist',
      isAgentReview: true,
    })
    expect(result.updateFields.status).toBe('pending_review')
  })

  it('human approval on any post moves it to approved', () => {
    const result = validateTransition({
      postId: 'gate-test',
      from: 'pending_review',
      to: 'approved',
      agentName: 'client',
      isAgentReview: false,
    })
    expect(result.updateFields.status).toBe('approved')
  })

  it('default (no isAgentReview flag) treats as human approval', () => {
    const result = validateTransition({
      postId: 'gate-test',
      from: 'pending_review',
      to: 'approved',
      agentName: 'client',
    })
    expect(result.updateFields.status).toBe('approved')
  })
})

// ---------------------------------------------------------------------------
// Regression: reviewed_by_agent clearing
// ---------------------------------------------------------------------------

describe('Regression: reviewed_by_agent is cleared on re-entry to pending_review', () => {
  const sources: PostStatus[] = ['approved', 'rejected', 'revision', 'draft', 'scheduled', 'publish_failed']

  for (const from of sources) {
    if (isValidTransition(from, 'pending_review')) {
      it(`${from} → pending_review clears reviewed_by_agent`, () => {
        const opts: { rejectionReason?: string } = {}
        // revision doesn't need rejection reason for going to pending_review
        const result = validateTransition({
          postId: 'clear-agent-test',
          from,
          to: 'pending_review',
          agentName: 'system',
          ...opts,
        })
        expect(result.updateFields.reviewed_by_agent).toBeNull()
      })
    }
  }
})

// ---------------------------------------------------------------------------
// Regression: Rejection state clearing on reopen
// ---------------------------------------------------------------------------

describe('Regression: rejection state cleared on reopen', () => {
  it('rejected → pending_review clears rejection_reason', () => {
    const result = validateTransition({
      postId: 'reopen-test',
      from: 'rejected',
      to: 'pending_review',
      agentName: 'client',
    })
    expect(result.updateFields.rejection_reason).toBeNull()
    expect(result.updateFields.delete_scheduled_at).toBeNull()
  })

  it('rejected → draft clears rejection_reason', () => {
    const result = validateTransition({
      postId: 'reopen-test',
      from: 'rejected',
      to: 'draft',
      agentName: 'client',
    })
    expect(result.updateFields.rejection_reason).toBeNull()
    expect(result.updateFields.delete_scheduled_at).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Regression: getAllowedNextStatuses completeness
// ---------------------------------------------------------------------------

describe('Regression: getAllowedNextStatuses returns correct options', () => {
  const expected: Record<PostStatus, PostStatus[]> = {
    draft: ['pending_review'],
    pending_review: ['approved', 'rejected', 'revision'],
    approved: ['scheduled', 'published', 'pending_review'],
    rejected: ['draft', 'pending_review'],
    revision: ['pending_review'],
    scheduled: ['published', 'approved', 'publish_failed', 'pending_review'],
    published: [],
    publish_failed: ['scheduled', 'draft', 'pending_review'],
  }

  for (const [status, transitions] of Object.entries(expected)) {
    it(`${status} allows: ${transitions.length > 0 ? transitions.join(', ') : '(none)'}`, () => {
      expect(getAllowedNextStatuses(status as PostStatus)).toEqual(transitions)
    })
  }
})
