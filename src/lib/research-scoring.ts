import type { ContentPillar } from '@/lib/types'

/** Weights for each scoring dimension (must sum to 1.0) */
const WEIGHTS = {
  recency: 0.3,
  pillarFit: 0.4,
  contentQuality: 0.3,
} as const

/** How many days before a source is considered fully stale */
const RECENCY_HALF_LIFE_DAYS = 30

/**
 * Score recency on a 0-1 scale using exponential decay.
 * Today = 1.0, 30 days ago ≈ 0.5, 60 days ≈ 0.25, etc.
 */
export function scoreRecency(createdAt?: string | null): number {
  if (!createdAt) return 0.5 // unknown date → neutral
  const ageMs = Date.now() - new Date(createdAt).getTime()
  const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24))
  return Math.exp((-Math.LN2 * ageDays) / RECENCY_HALF_LIFE_DAYS)
}

/**
 * Score content quality based on observable signals:
 * - has raw_content with reasonable length
 * - has a source_url (verifiable)
 * - source_type specificity
 */
export function scoreContentQuality(item: {
  raw_content?: string | null
  source_url?: string | null
  source_type?: string | null
  title?: string | null
}): number {
  let score = 0

  // Title present and descriptive (>10 chars)
  if (item.title && item.title.length > 10) score += 0.15
  else if (item.title) score += 0.05

  // Raw content length scoring (longer = more useful, diminishing returns)
  const contentLen = item.raw_content?.length ?? 0
  if (contentLen > 2000) score += 0.35
  else if (contentLen > 500) score += 0.25
  else if (contentLen > 100) score += 0.15
  else if (contentLen > 0) score += 0.05

  // Has a verifiable source URL
  if (item.source_url) score += 0.2

  // Specific source types score higher than generic
  const specificTypes = ['linkedin', 'report', 'whatsapp']
  if (item.source_type && specificTypes.includes(item.source_type)) {
    score += 0.3
  } else if (item.source_type && item.source_type !== 'other') {
    score += 0.15
  }

  return Math.min(1, score)
}

/** Common English words that carry no topical signal */
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'new', 'how', 'can', 'all', 'any', 'our',
  'its', 'are', 'was', 'has', 'had', 'not', 'but', 'from', 'this', 'that',
  'they', 'will', 'have', 'been', 'you', 'your', 'their', 'what', 'who',
])

/**
 * Tokenize text into lowercase words for matching.
 * Filters out short tokens and common stopwords.
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  )
}

/**
 * Score how well content matches a single pillar (0-1).
 * Matches against pillar name, description, example_hooks, and audience_summary.
 */
export function scorePillarFit(
  content: string,
  pillar: ContentPillar
): number {
  if (!content || content.length === 0) return 0

  const contentTokens = tokenize(content)
  if (contentTokens.size === 0) return 0

  // Build pillar keyword corpus from all text fields
  const pillarText = [
    pillar.name,
    pillar.slug.replace(/-/g, ' '),
    pillar.description ?? '',
    pillar.audience_summary ?? '',
    ...(pillar.example_hooks ?? []),
  ].join(' ')

  const pillarTokens = tokenize(pillarText)
  if (pillarTokens.size === 0) return 0

  // Count overlapping tokens
  let matches = 0
  for (const token of contentTokens) {
    if (pillarTokens.has(token)) matches++
  }

  // Jaccard-like similarity but weighted toward content coverage
  const contentCoverage = matches / contentTokens.size
  const pillarCoverage = matches / pillarTokens.size
  const similarity = 0.6 * contentCoverage + 0.4 * pillarCoverage

  // Scale to 0-1 with a reasonable ceiling (perfect match unlikely)
  return Math.min(1, similarity * 2.5)
}

/**
 * Find the best matching pillar for a piece of content.
 * Returns the pillar and its fit score, or null if no pillars available.
 */
export function matchPillar(
  content: string,
  pillars: ContentPillar[]
): { pillar: ContentPillar; score: number } | null {
  if (!pillars.length || !content) return null

  let bestPillar: ContentPillar | null = null
  let bestScore = 0

  for (const pillar of pillars) {
    const score = scorePillarFit(content, pillar)
    if (score > bestScore) {
      bestScore = score
      bestPillar = pillar
    }
  }

  // Only match if score exceeds minimum threshold
  if (!bestPillar || bestScore < 0.20) return null

  return { pillar: bestPillar, score: bestScore }
}

/**
 * Compute the composite relevance score (0-1) for a research item.
 */
export function computeRelevanceScore(item: {
  title?: string | null
  raw_content?: string | null
  source_url?: string | null
  source_type?: string | null
  created_at?: string | null
  pillar_fit_score?: number
}): number {
  const recency = scoreRecency(item.created_at)
  const quality = scoreContentQuality(item)
  const pillarFit = item.pillar_fit_score ?? 0

  return (
    WEIGHTS.recency * recency +
    WEIGHTS.pillarFit * pillarFit +
    WEIGHTS.contentQuality * quality
  )
}

/**
 * Build the searchable text for pillar matching from a research item.
 */
export function buildMatchableText(item: {
  title?: string | null
  raw_content?: string | null
}): string {
  return [item.title ?? '', item.raw_content ?? ''].join(' ').trim()
}
