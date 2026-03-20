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

/**
 * Returns a human-readable tooltip string describing a post's freshness/expiry state.
 * Returns an empty string for evergreen posts or posts with no expiry.
 */
export function getStalenessTooltip(post: Pick<Post, 'freshness_type' | 'expiry_date' | 'archived_at'>): string {
  if (post.archived_at) return 'Archived'
  if (!post.expiry_date || post.freshness_type === 'evergreen') return ''

  const typeLabel = post.freshness_type === 'time_sensitive' ? 'Time-sensitive' : 'Date-locked'
  const expiry = new Date(post.expiry_date)
  const dateStr = expiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const daysUntil = Math.floor((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  if (daysUntil < 0) {
    return `${typeLabel} · Expired ${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''} ago (${dateStr})`
  }
  if (daysUntil === 0) return `${typeLabel} · Expires today (${dateStr})`
  return `${typeLabel} · Expires in ${daysUntil} day${daysUntil !== 1 ? 's' : ''} (${dateStr})`
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
