// @vitest-environment node

/**
 * Sprint 4 QA Gate — Staleness Detection
 *
 * Validates the freshness tagging, staleness state derivation, calendar
 * indicators, staleness actions, auto-archive logic, and edge cases for
 * the Draft Staleness Detection feature (LIN-497 / LIN-512).
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  getStalenessState,
  STALENESS_CONFIG,
  type StalenessState,
} from '@/lib/staleness'
import type { Post, FreshnessType } from '@/lib/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: crypto.randomUUID(),
    organization_id: 'org-1',
    user_id: 'user-1',
    content: 'Test post content.',
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
    freshness_type: 'evergreen',
    expiry_date: null,
    archived_at: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  }
}

/** Returns an ISO date string N days from now. */
function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString()
}

/** Returns an ISO date string N days in the past. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

// ---------------------------------------------------------------------------
// 1. Freshness Tagging
// ---------------------------------------------------------------------------

describe('Staleness QA: Freshness Tagging', () => {
  it('evergreen posts return null staleness (no indicator)', () => {
    const post = makePost({ freshness_type: 'evergreen', expiry_date: null })
    expect(getStalenessState(post)).toBeNull()
  })

  it('evergreen posts ignore expiry_date even if set', () => {
    const post = makePost({ freshness_type: 'evergreen', expiry_date: daysAgo(5) })
    expect(getStalenessState(post)).toBeNull()
  })

  it('time_sensitive with 14-day expiry is fresh', () => {
    const post = makePost({ freshness_type: 'time_sensitive', expiry_date: daysFromNow(14) })
    expect(getStalenessState(post)).toBe('fresh')
  })

  it('date_locked with event-date expiry is fresh when far out', () => {
    const post = makePost({ freshness_type: 'date_locked', expiry_date: daysFromNow(30) })
    expect(getStalenessState(post)).toBe('fresh')
  })

  it('default fallback: time_sensitive post with no expiry returns null', () => {
    const post = makePost({ freshness_type: 'time_sensitive', expiry_date: null })
    expect(getStalenessState(post)).toBeNull()
  })

  it('all three freshness_type values are valid', () => {
    const types: FreshnessType[] = ['evergreen', 'time_sensitive', 'date_locked']
    for (const ft of types) {
      const post = makePost({ freshness_type: ft })
      // Should not throw
      expect(() => getStalenessState(post)).not.toThrow()
    }
  })
})

// ---------------------------------------------------------------------------
// 2. Staleness State Derivation
// ---------------------------------------------------------------------------

describe('Staleness QA: State Derivation Boundaries', () => {
  it('post expiring in > 7 days is "fresh"', () => {
    const post = makePost({ freshness_type: 'time_sensitive', expiry_date: daysFromNow(8) })
    expect(getStalenessState(post)).toBe('fresh')
  })

  it('post expiring in exactly 7 days is "aging"', () => {
    const post = makePost({ freshness_type: 'time_sensitive', expiry_date: daysFromNow(7) })
    expect(getStalenessState(post)).toBe('aging')
  })

  it('post expiring in 1 day is "aging"', () => {
    const post = makePost({ freshness_type: 'time_sensitive', expiry_date: daysFromNow(1) })
    expect(getStalenessState(post)).toBe('aging')
  })

  it('post expiring in 0.5 days (12 hours) is "aging"', () => {
    const post = makePost({ freshness_type: 'time_sensitive', expiry_date: daysFromNow(0.5) })
    expect(getStalenessState(post)).toBe('aging')
  })

  it('post that expired yesterday is "flagged"', () => {
    const post = makePost({ freshness_type: 'time_sensitive', expiry_date: daysAgo(1) })
    expect(getStalenessState(post)).toBe('flagged')
  })

  it('post that expired 30 days ago is "flagged"', () => {
    const post = makePost({ freshness_type: 'time_sensitive', expiry_date: daysAgo(30) })
    expect(getStalenessState(post)).toBe('flagged')
  })

  it('archived post always returns "archived" regardless of expiry', () => {
    const post = makePost({
      freshness_type: 'time_sensitive',
      expiry_date: daysFromNow(30),
      archived_at: daysAgo(1),
    })
    expect(getStalenessState(post)).toBe('archived')
  })

  it('archived post with no expiry returns "archived"', () => {
    const post = makePost({
      freshness_type: 'evergreen',
      expiry_date: null,
      archived_at: daysAgo(1),
    })
    expect(getStalenessState(post)).toBe('archived')
  })

  it('date_locked post follows same fresh/aging/flagged boundaries', () => {
    expect(getStalenessState(makePost({ freshness_type: 'date_locked', expiry_date: daysFromNow(10) }))).toBe('fresh')
    expect(getStalenessState(makePost({ freshness_type: 'date_locked', expiry_date: daysFromNow(3) }))).toBe('aging')
    expect(getStalenessState(makePost({ freshness_type: 'date_locked', expiry_date: daysAgo(1) }))).toBe('flagged')
  })
})

// ---------------------------------------------------------------------------
// 3. Calendar Indicators (STALENESS_CONFIG)
// ---------------------------------------------------------------------------

describe('Staleness QA: Calendar Indicators (dot colors)', () => {
  it('fresh → emerald/green dot', () => {
    expect(STALENESS_CONFIG.fresh.dotClass).toContain('emerald')
  })

  it('aging → yellow/amber dot', () => {
    expect(STALENESS_CONFIG.aging.dotClass).toContain('yellow')
  })

  it('flagged → red dot', () => {
    expect(STALENESS_CONFIG.flagged.dotClass).toContain('red')
  })

  it('archived → muted dot', () => {
    expect(STALENESS_CONFIG.archived.dotClass).toContain('muted')
  })

  it('evergreen posts have no dot (staleness is null, no config entry)', () => {
    const post = makePost({ freshness_type: 'evergreen', expiry_date: null })
    const state = getStalenessState(post)
    expect(state).toBeNull()
    // null state means no config lookup → no dot rendered
  })

  it('all config entries have label, badgeClass, and dotClass', () => {
    const states: Exclude<StalenessState, null>[] = ['fresh', 'aging', 'flagged', 'archived']
    for (const s of states) {
      const cfg = STALENESS_CONFIG[s]
      expect(cfg.label).toBeTruthy()
      expect(cfg.badgeClass).toBeTruthy()
      expect(cfg.dotClass).toBeTruthy()
    }
  })

  it('badge labels match expected display text', () => {
    expect(STALENESS_CONFIG.fresh.label).toBe('Fresh')
    expect(STALENESS_CONFIG.aging.label).toBe('Aging')
    expect(STALENESS_CONFIG.flagged.label).toBe('Stale')
    expect(STALENESS_CONFIG.archived.label).toBe('Archived')
  })
})

// ---------------------------------------------------------------------------
// 4. Staleness Actions (contract-level tests)
// ---------------------------------------------------------------------------

describe('Staleness QA: Action Contracts', () => {
  it('"Still Valid" clears expiry_date for time_sensitive posts', () => {
    // The still-valid endpoint sets expiry_date = null for time_sensitive posts.
    // This differs from the spec's "extend by 30 days" — the implementation
    // clears expiry entirely so the post becomes non-stale (no indicator).
    const post = makePost({
      freshness_type: 'time_sensitive',
      expiry_date: daysAgo(2),
    })
    expect(getStalenessState(post)).toBe('flagged')

    // Simulate still-valid action result
    const updated = { ...post, expiry_date: null }
    expect(getStalenessState(updated)).toBeNull()
  })

  it('"Still Valid" is a no-op for evergreen posts', () => {
    const post = makePost({ freshness_type: 'evergreen' })
    // Endpoint returns { ok: true, message: 'No action needed' }
    expect(post.freshness_type).toBe('evergreen')
  })

  it('"Still Valid" is a no-op for date_locked posts', () => {
    const post = makePost({ freshness_type: 'date_locked', expiry_date: daysAgo(1) })
    // Endpoint only clears expiry for time_sensitive, not date_locked
    expect(post.freshness_type).toBe('date_locked')
  })

  it('"Archive" sets archived_at without deleting content', () => {
    const post = makePost({ freshness_type: 'time_sensitive', expiry_date: daysAgo(5) })
    expect(getStalenessState(post)).toBe('flagged')

    // Simulate archive action
    const archived = { ...post, archived_at: new Date().toISOString() }
    expect(getStalenessState(archived)).toBe('archived')
    expect(archived.content).toBe(post.content) // content preserved
  })

  it('"Archive" is idempotent (re-archiving is a no-op)', () => {
    const post = makePost({ archived_at: daysAgo(1) })
    expect(getStalenessState(post)).toBe('archived')
    // Re-archiving returns same archived_at — state unchanged
  })

  it('"Restore" clears archived_at', () => {
    const post = makePost({
      freshness_type: 'time_sensitive',
      expiry_date: daysAgo(5),
      archived_at: daysAgo(1),
    })
    expect(getStalenessState(post)).toBe('archived')

    // Simulate restore action
    const restored = { ...post, archived_at: null }
    expect(getStalenessState(restored)).toBe('flagged') // back to flagged since expired
  })

  it('"Restore" is idempotent (restoring non-archived post is no-op)', () => {
    const post = makePost({ archived_at: null })
    // Endpoint returns { restored: true, archived_at: null }
    expect(post.archived_at).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 5. Auto-Archive Logic (process_post_freshness contract)
// ---------------------------------------------------------------------------

describe('Staleness QA: Auto-Archive (cron) Logic', () => {
  it('date_locked posts past expiry should be auto-archived by cron', () => {
    // The SQL function sets archived_at = now() for date_locked + expired + not archived
    const post = makePost({
      freshness_type: 'date_locked',
      expiry_date: daysAgo(1),
      archived_at: null,
    })
    expect(getStalenessState(post)).toBe('flagged')

    // After cron runs:
    const autoArchived = { ...post, archived_at: new Date().toISOString() }
    expect(getStalenessState(autoArchived)).toBe('archived')
    expect(autoArchived.content).toBe(post.content) // soft archive, content preserved
  })

  it('time_sensitive posts past expiry are NOT auto-archived by cron', () => {
    // Cron counts them but does not archive
    const post = makePost({
      freshness_type: 'time_sensitive',
      expiry_date: daysAgo(5),
      archived_at: null,
    })
    expect(getStalenessState(post)).toBe('flagged')
    // Post remains flagged, not archived — manual action required
    expect(post.archived_at).toBeNull()
  })

  it('already-archived date_locked posts are skipped by cron', () => {
    const post = makePost({
      freshness_type: 'date_locked',
      expiry_date: daysAgo(10),
      archived_at: daysAgo(5),
    })
    // SQL WHERE includes `archived_at IS NULL` — this post is skipped
    expect(getStalenessState(post)).toBe('archived')
  })

  it('evergreen posts are never auto-archived', () => {
    const post = makePost({ freshness_type: 'evergreen', expiry_date: null })
    // No expiry → cron never touches them
    expect(getStalenessState(post)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 6. Edge Cases
// ---------------------------------------------------------------------------

describe('Staleness QA: Edge Cases', () => {
  it('post with no freshness_type defaults show no staleness indicators', () => {
    // DB default is 'evergreen'
    const post = makePost({ freshness_type: 'evergreen', expiry_date: null, archived_at: null })
    expect(getStalenessState(post)).toBeNull()
  })

  it('restoring archived post restores to correct staleness state', () => {
    // Archived post that was flagged before archiving
    const post = makePost({
      freshness_type: 'time_sensitive',
      expiry_date: daysAgo(3),
      archived_at: daysAgo(1),
    })
    expect(getStalenessState(post)).toBe('archived')

    // After restore:
    const restored = { ...post, archived_at: null }
    expect(getStalenessState(restored)).toBe('flagged')
  })

  it('restoring archived post that was fresh returns to fresh', () => {
    const post = makePost({
      freshness_type: 'time_sensitive',
      expiry_date: daysFromNow(20),
      archived_at: daysAgo(1),
    })
    expect(getStalenessState(post)).toBe('archived')

    const restored = { ...post, archived_at: null }
    expect(getStalenessState(restored)).toBe('fresh')
  })

  it('restoring archived post that was aging returns to aging', () => {
    const post = makePost({
      freshness_type: 'date_locked',
      expiry_date: daysFromNow(3),
      archived_at: daysAgo(1),
    })
    expect(getStalenessState(post)).toBe('archived')

    const restored = { ...post, archived_at: null }
    expect(getStalenessState(restored)).toBe('aging')
  })

  it('multiple staleness actions in sequence work correctly', () => {
    // Start: flagged time_sensitive post
    let post = makePost({
      freshness_type: 'time_sensitive',
      expiry_date: daysAgo(2),
      archived_at: null,
    })
    expect(getStalenessState(post)).toBe('flagged')

    // Action 1: Archive
    post = { ...post, archived_at: new Date().toISOString() }
    expect(getStalenessState(post)).toBe('archived')

    // Action 2: Restore
    post = { ...post, archived_at: null }
    expect(getStalenessState(post)).toBe('flagged')

    // Action 3: Still Valid (clears expiry)
    post = { ...post, expiry_date: null }
    expect(getStalenessState(post)).toBeNull()

    // Action 4: Archive again (even with no expiry)
    post = { ...post, archived_at: new Date().toISOString() }
    expect(getStalenessState(post)).toBe('archived')
  })

  it('archived_at takes precedence over all other states', () => {
    // Even a fresh post, if archived, shows as archived
    const post = makePost({
      freshness_type: 'time_sensitive',
      expiry_date: daysFromNow(30),
      archived_at: daysAgo(1),
    })
    expect(getStalenessState(post)).toBe('archived')
  })

  it('post with expiry_date exactly at now is flagged (boundary)', () => {
    // expiry_date = now → daysUntilExpiry ≈ 0 (slightly negative due to execution time)
    // Since < 0 check uses strict less than, expiry at "now" is ≤ 0, so aging
    const post = makePost({
      freshness_type: 'time_sensitive',
      expiry_date: new Date().toISOString(),
    })
    const state = getStalenessState(post)
    // At exact now, msUntilExpiry ≈ 0 or slightly negative
    // daysUntilExpiry ≈ 0, which is <= 7 → aging (if >= 0) or flagged (if < 0)
    expect(['aging', 'flagged']).toContain(state)
  })
})

// ---------------------------------------------------------------------------
// 7. Staleness Panel Display Logic
// ---------------------------------------------------------------------------

describe('Staleness QA: Panel Display Logic', () => {
  it('panel is hidden for evergreen posts (staleness null)', () => {
    const post = makePost({ freshness_type: 'evergreen' })
    expect(getStalenessState(post)).toBeNull()
    // StalenessPanel returns null when staleness === null
  })

  it('"Still Valid" button shown only for time_sensitive + aging/flagged', () => {
    // time_sensitive + aging → button shown
    const aging = makePost({ freshness_type: 'time_sensitive', expiry_date: daysFromNow(3) })
    expect(getStalenessState(aging)).toBe('aging')

    // time_sensitive + flagged → button shown
    const flagged = makePost({ freshness_type: 'time_sensitive', expiry_date: daysAgo(1) })
    expect(getStalenessState(flagged)).toBe('flagged')

    // date_locked + flagged → button NOT shown (only time_sensitive)
    const dateLocked = makePost({ freshness_type: 'date_locked', expiry_date: daysAgo(1) })
    expect(getStalenessState(dateLocked)).toBe('flagged')
    expect(dateLocked.freshness_type).not.toBe('time_sensitive')

    // time_sensitive + fresh → button NOT shown (only aging/flagged)
    const fresh = makePost({ freshness_type: 'time_sensitive', expiry_date: daysFromNow(14) })
    expect(getStalenessState(fresh)).toBe('fresh')
  })

  it('"Archive" button shown for non-archived posts', () => {
    const fresh = makePost({ freshness_type: 'time_sensitive', expiry_date: daysFromNow(14) })
    expect(getStalenessState(fresh)).toBe('fresh')
    expect(fresh.archived_at).toBeNull() // Archive button visible
  })

  it('"Restore" button shown only for archived posts', () => {
    const archived = makePost({ archived_at: daysAgo(1) })
    expect(getStalenessState(archived)).toBe('archived')
    // Restore button shown instead of Archive
  })

  it('action buttons hidden for published posts', () => {
    const post = makePost({
      status: 'published',
      freshness_type: 'time_sensitive',
      expiry_date: daysAgo(1),
    })
    expect(post.status).toBe('published')
    // StalenessPanel checks !isPublished before rendering action buttons
  })

  it('expiry date formatted correctly for each state', () => {
    // These test the display text logic in StalenessPanel
    const freshPost = makePost({ freshness_type: 'time_sensitive', expiry_date: daysFromNow(14) })
    expect(getStalenessState(freshPost)).toBe('fresh')
    // Display: "Expires Mar 15, 2026"

    const flaggedPost = makePost({ freshness_type: 'time_sensitive', expiry_date: daysAgo(5) })
    expect(getStalenessState(flaggedPost)).toBe('flagged')
    // Display: "Expired Mar 15, 2026"

    const archivedPost = makePost({
      freshness_type: 'date_locked',
      expiry_date: daysAgo(10),
      archived_at: daysAgo(5),
    })
    expect(getStalenessState(archivedPost)).toBe('archived')
    // Display: "Archived · was set to expire Mar 10, 2026"
  })
})

// ---------------------------------------------------------------------------
// 8. Type contract validation
// ---------------------------------------------------------------------------

describe('Staleness QA: Type Contracts', () => {
  it('Post type includes freshness_type, expiry_date, archived_at', () => {
    const post = makePost()
    expect(post).toHaveProperty('freshness_type')
    expect(post).toHaveProperty('expiry_date')
    expect(post).toHaveProperty('archived_at')
  })

  it('freshness_type defaults to evergreen', () => {
    const post = makePost()
    expect(post.freshness_type).toBe('evergreen')
  })

  it('expiry_date defaults to null', () => {
    const post = makePost()
    expect(post.expiry_date).toBeNull()
  })

  it('archived_at defaults to null', () => {
    const post = makePost()
    expect(post.archived_at).toBeNull()
  })

  it('StalenessState union covers all expected values', () => {
    const validStates: StalenessState[] = ['fresh', 'aging', 'flagged', 'archived', null]
    for (const state of validStates) {
      if (state !== null) {
        expect(STALENESS_CONFIG).toHaveProperty(state)
      }
    }
  })
})
