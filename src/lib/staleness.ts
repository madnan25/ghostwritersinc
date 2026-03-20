import type { Post } from '@/lib/types'

/** Visual staleness state derived from post freshness metadata. */
export type StalenessState = 'fresh' | 'aging' | 'flagged' | 'archived' | null

/**
 * Derives the staleness display state from a post's freshness metadata.
 *
 * - null       → evergreen or no expiry (no staleness indicator shown)
 * - 'fresh'    → time_sensitive/date_locked, expiry > 7 days away
 * - 'aging'    → expiry within 7 days
 * - 'flagged'  → expiry has passed (stale)
 * - 'archived' → post has been soft-archived
 */
export function getStalenessState(post: Pick<Post, 'freshness_type' | 'expiry_date' | 'archived_at'>): StalenessState {
  if (post.archived_at) return 'archived'
  if (!post.expiry_date || post.freshness_type === 'evergreen') return null

  const msUntilExpiry = new Date(post.expiry_date).getTime() - Date.now()
  const daysUntilExpiry = msUntilExpiry / (1000 * 60 * 60 * 24)

  if (daysUntilExpiry < 0) return 'flagged'
  if (daysUntilExpiry <= 7) return 'aging'
  return 'fresh'
}

export interface StalenessConfig {
  label: string
  /** Tailwind classes for inline badge (bg + text + border) */
  badgeClass: string
  /** Tailwind dot color class for calendar indicator */
  dotClass: string
}

export const STALENESS_CONFIG: Record<Exclude<StalenessState, null>, StalenessConfig> = {
  fresh: {
    label: 'Fresh',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    dotClass: 'bg-emerald-400',
  },
  aging: {
    label: 'Aging',
    badgeClass: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
    dotClass: 'bg-yellow-400',
  },
  flagged: {
    label: 'Stale',
    badgeClass: 'bg-red-500/15 text-red-400 border-red-500/25',
    dotClass: 'bg-red-400',
  },
  archived: {
    label: 'Archived',
    badgeClass: 'bg-muted text-muted-foreground border-border',
    dotClass: 'bg-muted-foreground',
  },
}
