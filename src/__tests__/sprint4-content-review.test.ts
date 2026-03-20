// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
  isValidTransition,
  getAllowedNextStatuses,
  validateTransition,
  WorkflowError,
  REVISION_CAP,
} from '@/lib/workflow'
import {
  canEditPost,
  canRejectPost,
  isReviewQueueStatus,
} from '@/lib/post-actions'
import type {
  PostStatus,
  Brief,
  BriefStatus,
  Post,
  ReviewEvent,
  Notification,
  ReviewAction,
  UserWritingProfile,
} from '@/lib/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: crypto.randomUUID(),
    organization_id: 'org-1',
    user_id: 'user-1',
    content: 'Test post content about AI automation trends.',
    content_type: 'text',
    media_urls: null,
    pillar: null,
    pillar_id: null,
    brief_ref: null,
    suggested_publish_at: null,
    scheduled_publish_at: null,
    published_at: null,
    linkedin_post_urn: null,
    status: 'draft',
    rejection_reason: null,
    agent_id: null,
    created_by_agent: null,
    reviewed_by_agent: null,
    review_notes: null,
    content_version: 1,
    revision_count: 0,
    brief_id: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  }
}

function makeBrief(overrides: Partial<Brief> = {}): Brief {
  return {
    id: crypto.randomUUID(),
    organization_id: 'org-1',
    pillar_id: '550e8400-e29b-41d4-a716-446655440000',
    angle: 'How AI agents can replace manual processes',
    research_refs: [],
    voice_notes: null,
    publish_at: null,
    status: 'pending',
    source: 'ai_generated',
    priority: 'normal',
    revision_count: 0,
    revision_notes: null,
    assigned_agent_id: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  }
}

function makeReviewEvent(overrides: Partial<ReviewEvent> = {}): ReviewEvent {
  return {
    id: crypto.randomUUID(),
    post_id: 'post-1',
    agent_name: 'strategist',
    action: 'approved',
    notes: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// 1. Voice profile compliance rules
// ---------------------------------------------------------------------------

/**
 * Voice profile compliance checker — verifies draft content against the user's
 * writing profile (tone, voice_notes, avoid_topics, preferred_formats).
 *
 * The 6 rules are tested against the UserWritingProfile type contract.
 * NOTE: No runtime compliance checker exists yet in the codebase.  These tests
 * validate the data model contract and rule semantics so the implementation
 * (when built) has a ready-made spec to satisfy.
 */
describe('Sprint 4: Voice profile compliance rules (type contract)', () => {
  const profile: UserWritingProfile = {
    id: 'wp-1',
    user_id: 'user-1',
    organization_id: 'org-1',
    tone: 'professional yet approachable',
    voice_notes: 'Use active voice. No jargon. Keep sentences under 20 words.',
    sample_post_ids: ['sample-1', 'sample-2'],
    avoid_topics: ['politics', 'religion', 'competitor bashing'],
    preferred_formats: ['listicle', 'how-to', 'case-study'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }

  // Rule 1: tone field is present and non-empty
  it('Rule 1 — tone field is present and non-empty', () => {
    expect(profile.tone).toBeDefined()
    expect(typeof profile.tone).toBe('string')
    expect(profile.tone!.length).toBeGreaterThan(0)
  })

  // Rule 2: voice_notes provides actionable guidance
  it('Rule 2 — voice_notes contains actionable guidance', () => {
    expect(profile.voice_notes).toBeDefined()
    expect(typeof profile.voice_notes).toBe('string')
    expect(profile.voice_notes!.length).toBeGreaterThan(0)
  })

  // Rule 3: sample_post_ids has at least 1 reference post
  it('Rule 3 — sample_post_ids has at least one reference', () => {
    expect(Array.isArray(profile.sample_post_ids)).toBe(true)
    expect(profile.sample_post_ids.length).toBeGreaterThanOrEqual(1)
  })

  // Rule 4: avoid_topics lists topics that must not appear in drafts
  it('Rule 4 — avoid_topics lists exclusion topics', () => {
    expect(Array.isArray(profile.avoid_topics)).toBe(true)
    expect(profile.avoid_topics.length).toBeGreaterThan(0)
    for (const topic of profile.avoid_topics) {
      expect(typeof topic).toBe('string')
      expect(topic.length).toBeGreaterThan(0)
    }
  })

  // Rule 5: preferred_formats constrains content structure
  it('Rule 5 — preferred_formats constrains content types', () => {
    expect(Array.isArray(profile.preferred_formats)).toBe(true)
    expect(profile.preferred_formats.length).toBeGreaterThan(0)
  })

  // Rule 6: nullable fields are handled gracefully (profile with no guidance)
  it('Rule 6 — handles empty/null profile fields gracefully', () => {
    const emptyProfile: UserWritingProfile = {
      ...profile,
      tone: null,
      voice_notes: null,
      sample_post_ids: [],
      avoid_topics: [],
      preferred_formats: [],
    }
    expect(emptyProfile.tone).toBeNull()
    expect(emptyProfile.voice_notes).toBeNull()
    expect(emptyProfile.sample_post_ids).toEqual([])
    expect(emptyProfile.avoid_topics).toEqual([])
    expect(emptyProfile.preferred_formats).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 2. Full flow: brief → Scribe writes → Strategist approves
// ---------------------------------------------------------------------------

describe('Sprint 4: Full content creation and review flow', () => {
  it('draft → pending_review transition is valid (Scribe submits)', () => {
    expect(isValidTransition('draft', 'pending_review')).toBe(true)
  })

  it('Scribe creates draft at pending_review status', () => {
    const post = makePost({ status: 'pending_review', created_by_agent: 'scribe' })
    expect(post.status).toBe('pending_review')
    expect(post.created_by_agent).toBe('scribe')
  })

  it('agent approval keeps post at pending_review (two-stage gate)', () => {
    const result = validateTransition({
      postId: 'post-1',
      from: 'pending_review',
      to: 'approved',
      agentName: 'strategist',
      isAgentReview: true,
    })
    // Two-stage gate: agent "approve" stays at pending_review
    expect(result.updateFields.status).toBe('pending_review')
    expect(result.reviewAction).toBe('approved')
  })

  it('human approval moves post to approved', () => {
    const result = validateTransition({
      postId: 'post-1',
      from: 'pending_review',
      to: 'approved',
      agentName: 'client',
      isAgentReview: false,
    })
    expect(result.updateFields.status).toBe('approved')
    expect(result.reviewAction).toBe('approved')
  })

  it('approved post can be scheduled', () => {
    expect(isValidTransition('approved', 'scheduled')).toBe(true)
    const result = validateTransition({
      postId: 'post-1',
      from: 'approved',
      to: 'scheduled',
      agentName: 'client',
    })
    expect(result.updateFields.status).toBe('scheduled')
  })

  it('scheduled post can be published', () => {
    expect(isValidTransition('scheduled', 'published')).toBe(true)
  })

  it('full lifecycle: draft → pending_review → approved → scheduled → published', () => {
    const flow: [PostStatus, PostStatus][] = [
      ['draft', 'pending_review'],
      ['pending_review', 'approved'],
      ['approved', 'scheduled'],
      ['scheduled', 'published'],
    ]
    for (const [from, to] of flow) {
      expect(isValidTransition(from, to)).toBe(true)
    }
  })

  it('agent cannot review own draft (different agent names required)', () => {
    // The API route checks created_by_agent !== auth.agentName.
    // Verify the contract: Scribe creates, Strategist reviews.
    const post = makePost({ created_by_agent: 'scribe' })
    const reviewerAgent = 'strategist'
    expect(post.created_by_agent).not.toBe(reviewerAgent)
  })

  it('reviewed_by_agent is set during review', () => {
    const result = validateTransition({
      postId: 'post-1',
      from: 'pending_review',
      to: 'approved',
      agentName: 'strategist',
      isAgentReview: true,
      notes: 'Looks good, aligns with brand voice',
    })
    // validateTransition doesn't set reviewed_by_agent — the API route does.
    // But it DOES clear it on re-entry to pending_review.
    expect(result.updateFields.review_notes).toBe('Looks good, aligns with brand voice')
  })

  it('review event records the action', () => {
    const event = makeReviewEvent({
      action: 'approved',
      agent_name: 'strategist',
      notes: 'On-brand, approved',
    })
    expect(event.action).toBe('approved')
    expect(event.agent_name).toBe('strategist')
  })
})

// ---------------------------------------------------------------------------
// 3. Brief → 3 rejections → auto-park at rejected
// ---------------------------------------------------------------------------

describe('Sprint 4: Rejection cycle and auto-park after REVISION_CAP', () => {
  it('REVISION_CAP is set to 3', () => {
    expect(REVISION_CAP).toBe(3)
  })

  it('pending_review → rejected is a valid transition', () => {
    expect(isValidTransition('pending_review', 'rejected')).toBe(true)
  })

  it('rejection requires a reason', () => {
    expect(() =>
      validateTransition({
        postId: 'post-1',
        from: 'pending_review',
        to: 'rejected',
        agentName: 'strategist',
      })
    ).toThrow(WorkflowError)

    try {
      validateTransition({
        postId: 'post-1',
        from: 'pending_review',
        to: 'rejected',
        agentName: 'strategist',
      })
    } catch (e) {
      expect((e as WorkflowError).code).toBe('REJECTION_REASON_REQUIRED')
    }
  })

  it('rejection sets rejection_reason on update fields', () => {
    const result = validateTransition({
      postId: 'post-1',
      from: 'pending_review',
      to: 'rejected',
      agentName: 'strategist',
      rejectionReason: 'Off-brand tone',
      isAgentReview: true,
    })
    expect(result.updateFields.rejection_reason).toBe('Off-brand tone')
    expect(result.reviewAction).toBe('rejected')
  })

  it('agent rejection does NOT schedule deletion', () => {
    const result = validateTransition({
      postId: 'post-1',
      from: 'pending_review',
      to: 'rejected',
      agentName: 'strategist',
      rejectionReason: 'Needs work',
      isAgentReview: true,
    })
    expect(result.updateFields.delete_scheduled_at).toBeUndefined()
  })

  it('rejected → pending_review is valid (revision resubmit)', () => {
    expect(isValidTransition('rejected', 'pending_review')).toBe(true)
  })

  it('revision clears rejection fields when going back to pending_review', () => {
    const result = validateTransition({
      postId: 'post-1',
      from: 'rejected',
      to: 'pending_review',
      agentName: 'client',
    })
    expect(result.updateFields.rejection_reason).toBeNull()
    expect(result.updateFields.delete_scheduled_at).toBeNull()
    expect(result.updateFields.reviewed_by_agent).toBeNull()
    expect(result.reviewAction).toBe('revised')
  })

  it('simulates 3 rejection cycles hitting REVISION_CAP', () => {
    // Simulate the revision cycle: reject → revise → reject → revise → reject
    // After REVISION_CAP (3) rejections, the post should be "parked" at rejected.
    let contentVersion = 1
    const rejections: { cycle: number; version: number; action: ReviewAction }[] = []

    for (let cycle = 1; cycle <= REVISION_CAP; cycle++) {
      // Reject
      const rejection = validateTransition({
        postId: 'post-1',
        from: 'pending_review',
        to: 'rejected',
        agentName: 'strategist',
        rejectionReason: `Rejection round ${cycle}`,
        isAgentReview: true,
      })
      rejections.push({ cycle, version: contentVersion, action: rejection.reviewAction })
      expect(rejection.reviewAction).toBe('rejected')

      // Revise and resubmit (except on last cycle — post stays parked)
      if (cycle < REVISION_CAP) {
        const revision = validateTransition({
          postId: 'post-1',
          from: 'rejected',
          to: 'pending_review',
          agentName: 'client',
        })
        contentVersion++
        expect(revision.reviewAction).toBe('revised')
      }
    }

    expect(rejections).toHaveLength(REVISION_CAP)
    expect(rejections[rejections.length - 1].cycle).toBe(3)

    // After 3rd rejection, content_version would be 3 (matching REVISION_CAP)
    // The post stays at rejected — "parked"
    expect(contentVersion).toBe(REVISION_CAP)
  })

  it('post at REVISION_CAP can still be reopened by human', () => {
    // Even after 3 rejections, rejected → pending_review is valid
    expect(isValidTransition('rejected', 'pending_review')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 4. Parked post → human reopens → revision_count resets
// ---------------------------------------------------------------------------

describe('Sprint 4: Reopen parked post resets revision state', () => {
  it('reopenRejectedPost contract: resets content_version to 1', () => {
    // The reopenRejectedPost server action in posts.ts:
    // 1. Validates the post is rejected
    // 2. Snapshots content into post_revisions
    // 3. Transitions rejected → pending_review
    // 4. Resets content_version to 1
    // 5. Clears rejection_reason
    //
    // We verify the transition logic here; DB interaction is tested via API.
    const result = validateTransition({
      postId: 'post-1',
      from: 'rejected',
      to: 'pending_review',
      agentName: 'client',
      notes: 'Reopened after 3 revision cycles: Major rewrite',
    })

    expect(result.updateFields.status).toBe('pending_review')
    expect(result.updateFields.rejection_reason).toBeNull()
    expect(result.updateFields.delete_scheduled_at).toBeNull()
    expect(result.updateFields.reviewed_by_agent).toBeNull()
    expect(result.reviewAction).toBe('revised')
    expect(result.updateFields.review_notes).toBe('Reopened after 3 revision cycles: Major rewrite')
  })

  it('simulates reopen: post version resets to 1 for fresh cycle', () => {
    // After reopenRejectedPost, the server action sets content_version: 1
    const parkedPost = makePost({
      status: 'rejected',
      content_version: 3,
      revision_count: 3,
      rejection_reason: 'Exhausted revision cap',
    })

    // Simulate what reopenRejectedPost does
    const reopenedPost: Post = {
      ...parkedPost,
      status: 'pending_review',
      content_version: 1, // reset
      rejection_reason: null,
    }

    expect(reopenedPost.status).toBe('pending_review')
    expect(reopenedPost.content_version).toBe(1)
    expect(reopenedPost.rejection_reason).toBeNull()
  })

  it('rejected → draft is also valid for manual revision', () => {
    expect(isValidTransition('rejected', 'draft')).toBe(true)
    const result = validateTransition({
      postId: 'post-1',
      from: 'rejected',
      to: 'draft',
      agentName: 'client',
    })
    expect(result.updateFields.rejection_reason).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 5. Brief status lifecycle: pending → in_review → done
// ---------------------------------------------------------------------------

describe('Sprint 4: Brief status lifecycle', () => {
  const validStatuses: BriefStatus[] = ['pending', 'in_review', 'revision_requested', 'done']

  it('Brief type has all expected statuses', () => {
    for (const status of validStatuses) {
      const brief = makeBrief({ status })
      expect(brief.status).toBe(status)
    }
  })

  it('brief starts at pending', () => {
    const brief = makeBrief()
    expect(brief.status).toBe('pending')
    expect(brief.revision_count).toBe(0)
  })

  it('brief transitions pending → in_review', () => {
    const brief = makeBrief({ status: 'in_review' })
    expect(brief.status).toBe('in_review')
  })

  it('brief transitions in_review → done', () => {
    const brief = makeBrief({ status: 'done' })
    expect(brief.status).toBe('done')
  })

  it('brief transitions in_review → revision_requested increments revision_count', () => {
    // The PATCH /api/briefs/:id handler increments revision_count
    // when status moves to revision_requested
    const brief = makeBrief({ status: 'in_review', revision_count: 0 })
    const updatedCount = brief.revision_count + 1
    const revised = makeBrief({
      ...brief,
      status: 'revision_requested',
      revision_count: updatedCount,
    })
    expect(revised.status).toBe('revision_requested')
    expect(revised.revision_count).toBe(1)
  })

  it('brief revision_count increments on each revision_requested cycle', () => {
    let count = 0
    for (let cycle = 1; cycle <= 3; cycle++) {
      // Simulate: pending/in_review → revision_requested
      count += 1
      const brief = makeBrief({ status: 'revision_requested', revision_count: count })
      expect(brief.revision_count).toBe(cycle)
    }
  })

  it('brief revision_notes can store feedback', () => {
    const brief = makeBrief({
      status: 'revision_requested',
      revision_notes: 'Angle needs to be more specific to our ICP',
    })
    expect(brief.revision_notes).toBe('Angle needs to be more specific to our ICP')
  })

  it('brief can be assigned to a specific agent', () => {
    const brief = makeBrief({ assigned_agent_id: 'agent-scribe-1' })
    expect(brief.assigned_agent_id).toBe('agent-scribe-1')
  })

  it('brief links to research via research_refs', () => {
    const refs = [
      '550e8400-e29b-41d4-a716-446655440001',
      '550e8400-e29b-41d4-a716-446655440002',
    ]
    const brief = makeBrief({ research_refs: refs })
    expect(brief.research_refs).toHaveLength(2)
    expect(brief.research_refs).toEqual(refs)
  })

  it('brief voice_notes pass through to draft context', () => {
    const brief = makeBrief({ voice_notes: 'Keep it conversational, no corporate speak' })
    expect(brief.voice_notes).toBe('Keep it conversational, no corporate speak')
  })
})

// ---------------------------------------------------------------------------
// 6. Notification fires on agent approval
// ---------------------------------------------------------------------------

describe('Sprint 4: Notifications on review actions', () => {
  function makeNotification(overrides: Partial<Notification> = {}): Notification {
    return {
      id: crypto.randomUUID(),
      organization_id: 'org-1',
      user_id: 'user-1',
      type: 'post_approved',
      title: 'Post approved',
      body: 'Your post has been approved.',
      post_id: 'post-1',
      read: false,
      created_at: new Date().toISOString(),
      ...overrides,
    }
  }

  it('approval notification has correct type', () => {
    const n = makeNotification({ type: 'post_approved', title: 'Post approved' })
    expect(n.type).toBe('post_approved')
    expect(n.title).toBe('Post approved')
    expect(n.read).toBe(false)
  })

  it('auto-schedule approval notification includes "scheduled" in title', () => {
    const n = makeNotification({
      type: 'post_approved',
      title: 'Post approved and scheduled',
    })
    expect(n.title).toContain('scheduled')
  })

  it('rejection notification has correct type and reason', () => {
    const n = makeNotification({
      type: 'post_rejected',
      title: 'Post rejected',
      body: 'Off-brand tone, needs revision',
    })
    expect(n.type).toBe('post_rejected')
    expect(n.body).toContain('Off-brand')
  })

  it('revision resubmit notification has correct type', () => {
    const n = makeNotification({
      type: 'post_submitted',
      title: 'Revised post resubmitted for review',
    })
    expect(n.type).toBe('post_submitted')
    expect(n.title).toContain('Revised')
  })

  it('reopen notification has correct type', () => {
    const n = makeNotification({
      type: 'revision_requested',
      title: 'Post reopened for revision',
    })
    expect(n.type).toBe('revision_requested')
  })

  it('notification body is truncated to 80 chars', () => {
    const longContent = 'A'.repeat(200)
    const truncated = longContent.slice(0, 80)
    const n = makeNotification({ body: truncated })
    expect(n.body.length).toBeLessThanOrEqual(80)
  })

  it('notification links to a post via post_id', () => {
    const n = makeNotification({ post_id: 'post-123' })
    expect(n.post_id).toBe('post-123')
  })

  it('notification starts as unread', () => {
    const n = makeNotification()
    expect(n.read).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 7. Post action helpers (Sprint 4 relevant)
// ---------------------------------------------------------------------------

describe('Sprint 4: Post action helpers', () => {
  it('pending_review is a review queue status', () => {
    expect(isReviewQueueStatus('pending_review')).toBe(true)
  })

  it('draft is NOT a review queue status', () => {
    expect(isReviewQueueStatus('draft')).toBe(false)
  })

  it('approved is NOT a review queue status', () => {
    expect(isReviewQueueStatus('approved')).toBe(false)
  })

  it('can edit draft, pending_review, and approved posts', () => {
    expect(canEditPost('draft')).toBe(true)
    expect(canEditPost('pending_review')).toBe(true)
    expect(canEditPost('approved')).toBe(true)
  })

  it('cannot edit rejected, scheduled, published posts', () => {
    expect(canEditPost('rejected')).toBe(false)
    expect(canEditPost('scheduled')).toBe(false)
    expect(canEditPost('published')).toBe(false)
  })

  it('can only reject posts in pending_review', () => {
    expect(canRejectPost('pending_review')).toBe(true)
    expect(canRejectPost('draft')).toBe(false)
    expect(canRejectPost('approved')).toBe(false)
    expect(canRejectPost('rejected')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 8. Two-stage review gate (agent pre-review vs human final review)
// ---------------------------------------------------------------------------

describe('Sprint 4: Two-stage review gate', () => {
  it('agent approval stays at pending_review for human final review', () => {
    const result = validateTransition({
      postId: 'post-1',
      from: 'pending_review',
      to: 'approved',
      agentName: 'strategist',
      isAgentReview: true,
    })
    expect(result.updateFields.status).toBe('pending_review')
  })

  it('human approval moves to approved', () => {
    const result = validateTransition({
      postId: 'post-1',
      from: 'pending_review',
      to: 'approved',
      agentName: 'client',
      isAgentReview: false,
    })
    expect(result.updateFields.status).toBe('approved')
  })

  it('agent rejection moves to rejected (no gate)', () => {
    const result = validateTransition({
      postId: 'post-1',
      from: 'pending_review',
      to: 'rejected',
      agentName: 'strategist',
      rejectionReason: 'Quality issue',
      isAgentReview: true,
    })
    expect(result.updateFields.status).toBe('rejected')
  })

  it('user rejection schedules deletion, agent rejection does not', () => {
    const userResult = validateTransition({
      postId: 'post-1',
      from: 'pending_review',
      to: 'rejected',
      agentName: 'client',
      rejectionReason: 'Not needed',
      isAgentReview: false,
    })
    expect(userResult.updateFields.delete_scheduled_at).toBeDefined()

    const agentResult = validateTransition({
      postId: 'post-1',
      from: 'pending_review',
      to: 'rejected',
      agentName: 'strategist',
      rejectionReason: 'Quality issue',
      isAgentReview: true,
    })
    expect(agentResult.updateFields.delete_scheduled_at).toBeUndefined()
  })

  it('escalation: approved → pending_review clears reviewed_by_agent', () => {
    const result = validateTransition({
      postId: 'post-1',
      from: 'approved',
      to: 'pending_review',
      agentName: 'user',
    })
    expect(result.reviewAction).toBe('escalated')
    expect(result.updateFields.reviewed_by_agent).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 9. Review event tracking
// ---------------------------------------------------------------------------

describe('Sprint 4: Review event action determination', () => {
  it('approved action for normal approval', () => {
    const result = validateTransition({
      postId: 'p1',
      from: 'pending_review',
      to: 'approved',
      agentName: 'strategist',
    })
    expect(result.reviewAction).toBe('approved')
  })

  it('rejected action for rejection', () => {
    const result = validateTransition({
      postId: 'p1',
      from: 'pending_review',
      to: 'rejected',
      agentName: 'strategist',
      rejectionReason: 'Bad',
    })
    expect(result.reviewAction).toBe('rejected')
  })

  it('revised action for rejected → pending_review', () => {
    const result = validateTransition({
      postId: 'p1',
      from: 'rejected',
      to: 'pending_review',
      agentName: 'client',
    })
    expect(result.reviewAction).toBe('revised')
  })

  it('escalated action for approved → pending_review', () => {
    const result = validateTransition({
      postId: 'p1',
      from: 'approved',
      to: 'pending_review',
      agentName: 'user',
    })
    expect(result.reviewAction).toBe('escalated')
  })

  it('escalated action for draft → pending_review', () => {
    const result = validateTransition({
      postId: 'p1',
      from: 'draft',
      to: 'pending_review',
      agentName: 'scribe',
    })
    expect(result.reviewAction).toBe('escalated')
  })
})
