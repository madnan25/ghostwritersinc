/**
 * Voice Analysis — analyzes post diffs to identify editing patterns
 * and generates voice observations for the Strategist agent.
 *
 * The Strategist runs this analysis weekly or when 5+ new diffs accumulate.
 * Observations are surfaced to the user for confirm/dismiss/edit before
 * being applied to the writing profile as "Learned Preferences".
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DiffEditType } from './types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum number of post diffs required before running analysis. */
export const MIN_DIFFS_FOR_ANALYSIS = 5

/** Maximum observations to generate per analysis run. */
const MAX_OBSERVATIONS_PER_RUN = 5

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiffRecord {
  id: string
  post_id: string
  organization_id: string
  user_id: string
  original_content: string
  published_content: string
  edit_type: DiffEditType
  change_summary: string | null
  created_at: string
}

export interface EditPattern {
  pattern_type: 'tone_shift' | 'structure_change' | 'vocabulary' | 'length_adjustment' | 'formatting'
  description: string
  confidence: number
  source_post_ids: string[]
  evidence: string[]
}

export interface AnalysisResult {
  patterns: EditPattern[]
  no_edit_count: number
  minor_edit_count: number
  major_edit_count: number
  total_diffs: number
}

// ---------------------------------------------------------------------------
// Diff Categorization
// ---------------------------------------------------------------------------

/**
 * Categorize the edit type between original and published content.
 * - no_edit: content is identical (approval without edit)
 * - minor_edit: <20% of lines changed
 * - major_edit: >=20% of lines changed
 */
export function categorizeEdit(original: string, published: string): DiffEditType {
  if (original.trim() === published.trim()) return 'no_edit'

  const origLines = original.split('\n')
  const pubLines = published.split('\n')
  const maxLines = Math.max(origLines.length, pubLines.length, 1)

  let changedLines = 0
  for (let i = 0; i < maxLines; i++) {
    if ((origLines[i] ?? '') !== (pubLines[i] ?? '')) {
      changedLines++
    }
  }

  const changePct = changedLines / maxLines
  return changePct < 0.2 ? 'minor_edit' : 'major_edit'
}

/**
 * Generate a human-readable change summary between two content versions.
 */
export function generateChangeSummary(original: string, published: string): string {
  if (original.trim() === published.trim()) {
    return 'No edits — approved as-is.'
  }

  const changes: string[] = []

  // Length change
  const origLen = original.length
  const pubLen = published.length
  const lenDiff = pubLen - origLen
  if (Math.abs(lenDiff) > origLen * 0.1) {
    changes.push(
      lenDiff > 0
        ? `Content lengthened by ~${Math.round((lenDiff / origLen) * 100)}%`
        : `Content shortened by ~${Math.round((Math.abs(lenDiff) / origLen) * 100)}%`
    )
  }

  // Paragraph structure change
  const origParas = original.split(/\n\n+/).length
  const pubParas = published.split(/\n\n+/).length
  if (origParas !== pubParas) {
    changes.push(
      pubParas > origParas
        ? `Paragraphs increased from ${origParas} to ${pubParas}`
        : `Paragraphs reduced from ${origParas} to ${pubParas}`
    )
  }

  // Line break changes (formatting)
  const origLineBreaks = (original.match(/\n/g) ?? []).length
  const pubLineBreaks = (published.match(/\n/g) ?? []).length
  if (Math.abs(pubLineBreaks - origLineBreaks) > 2) {
    changes.push(`Line breaks changed from ${origLineBreaks} to ${pubLineBreaks}`)
  }

  return changes.length > 0 ? changes.join('; ') : 'Minor textual edits'
}

// ---------------------------------------------------------------------------
// Pattern Detection
// ---------------------------------------------------------------------------

/**
 * Detect tone shift patterns across multiple diffs.
 * Looks for consistent shortening/lengthening of sentences, formality shifts, etc.
 */
function detectTonePatterns(diffs: DiffRecord[]): EditPattern | null {
  const editedDiffs = diffs.filter((d) => d.edit_type !== 'no_edit')
  if (editedDiffs.length < 3) return null

  // Check for consistent shortening
  let shortenCount = 0
  let lengthenCount = 0
  for (const diff of editedDiffs) {
    const origAvgSentenceLen = averageSentenceLength(diff.original_content)
    const pubAvgSentenceLen = averageSentenceLength(diff.published_content)
    if (pubAvgSentenceLen < origAvgSentenceLen * 0.85) shortenCount++
    if (pubAvgSentenceLen > origAvgSentenceLen * 1.15) lengthenCount++
  }

  if (shortenCount >= Math.ceil(editedDiffs.length * 0.6)) {
    return {
      pattern_type: 'tone_shift',
      description: 'User consistently shortens sentences during editing, preferring more concise, punchy writing.',
      confidence: Math.min(0.9, 0.5 + shortenCount * 0.1),
      source_post_ids: editedDiffs.slice(0, 5).map((d) => d.post_id),
      evidence: [`${shortenCount}/${editedDiffs.length} posts had sentences shortened`],
    }
  }

  if (lengthenCount >= Math.ceil(editedDiffs.length * 0.6)) {
    return {
      pattern_type: 'tone_shift',
      description: 'User consistently expands sentences during editing, preferring more detailed, descriptive writing.',
      confidence: Math.min(0.9, 0.5 + lengthenCount * 0.1),
      source_post_ids: editedDiffs.slice(0, 5).map((d) => d.post_id),
      evidence: [`${lengthenCount}/${editedDiffs.length} posts had sentences expanded`],
    }
  }

  return null
}

/**
 * Detect structural editing patterns (paragraph changes, list usage, etc.).
 */
function detectStructurePatterns(diffs: DiffRecord[]): EditPattern | null {
  const editedDiffs = diffs.filter((d) => d.edit_type !== 'no_edit')
  if (editedDiffs.length < 3) return null

  let addedListsCount = 0
  let removedListsCount = 0
  let splitParagraphsCount = 0

  for (const diff of editedDiffs) {
    const origBullets = (diff.original_content.match(/^[-•*]\s/gm) ?? []).length
    const pubBullets = (diff.published_content.match(/^[-•*]\s/gm) ?? []).length
    if (pubBullets > origBullets + 1) addedListsCount++
    if (pubBullets < origBullets - 1) removedListsCount++

    const origParas = diff.original_content.split(/\n\n+/).length
    const pubParas = diff.published_content.split(/\n\n+/).length
    if (pubParas > origParas + 1) splitParagraphsCount++
  }

  if (addedListsCount >= Math.ceil(editedDiffs.length * 0.5)) {
    return {
      pattern_type: 'structure_change',
      description: 'User frequently converts prose into bullet lists for scannability.',
      confidence: Math.min(0.9, 0.5 + addedListsCount * 0.1),
      source_post_ids: editedDiffs.slice(0, 5).map((d) => d.post_id),
      evidence: [`${addedListsCount}/${editedDiffs.length} posts had lists added`],
    }
  }

  if (removedListsCount >= Math.ceil(editedDiffs.length * 0.5)) {
    return {
      pattern_type: 'structure_change',
      description: 'User frequently converts bullet lists into narrative prose.',
      confidence: Math.min(0.9, 0.5 + removedListsCount * 0.1),
      source_post_ids: editedDiffs.slice(0, 5).map((d) => d.post_id),
      evidence: [`${removedListsCount}/${editedDiffs.length} posts had lists removed`],
    }
  }

  if (splitParagraphsCount >= Math.ceil(editedDiffs.length * 0.5)) {
    return {
      pattern_type: 'structure_change',
      description: 'User prefers shorter paragraphs — frequently breaks long blocks into smaller chunks.',
      confidence: Math.min(0.85, 0.5 + splitParagraphsCount * 0.1),
      source_post_ids: editedDiffs.slice(0, 5).map((d) => d.post_id),
      evidence: [`${splitParagraphsCount}/${editedDiffs.length} posts had paragraphs split`],
    }
  }

  return null
}

/**
 * Detect length adjustment patterns.
 */
function detectLengthPatterns(diffs: DiffRecord[]): EditPattern | null {
  const editedDiffs = diffs.filter((d) => d.edit_type !== 'no_edit')
  if (editedDiffs.length < 3) return null

  let shorterCount = 0
  let longerCount = 0

  for (const diff of editedDiffs) {
    const ratio = diff.published_content.length / Math.max(diff.original_content.length, 1)
    if (ratio < 0.8) shorterCount++
    if (ratio > 1.2) longerCount++
  }

  if (shorterCount >= Math.ceil(editedDiffs.length * 0.6)) {
    const avgReduction = editedDiffs.reduce((sum, d) => {
      return sum + (1 - d.published_content.length / Math.max(d.original_content.length, 1))
    }, 0) / editedDiffs.length

    return {
      pattern_type: 'length_adjustment',
      description: `User consistently trims content by ~${Math.round(avgReduction * 100)}%. Prefer shorter drafts.`,
      confidence: Math.min(0.9, 0.5 + shorterCount * 0.1),
      source_post_ids: editedDiffs.slice(0, 5).map((d) => d.post_id),
      evidence: [`${shorterCount}/${editedDiffs.length} posts were shortened`],
    }
  }

  if (longerCount >= Math.ceil(editedDiffs.length * 0.6)) {
    return {
      pattern_type: 'length_adjustment',
      description: 'User consistently adds more content. Draft more detailed, longer-form posts.',
      confidence: Math.min(0.9, 0.5 + longerCount * 0.1),
      source_post_ids: editedDiffs.slice(0, 5).map((d) => d.post_id),
      evidence: [`${longerCount}/${editedDiffs.length} posts were expanded`],
    }
  }

  return null
}

/**
 * Detect formatting preference patterns (emoji usage, hashtags, hooks).
 */
function detectFormattingPatterns(diffs: DiffRecord[]): EditPattern | null {
  const editedDiffs = diffs.filter((d) => d.edit_type !== 'no_edit')
  if (editedDiffs.length < 3) return null

  let addedEmojisCount = 0
  let removedEmojisCount = 0
  let addedHashtagsCount = 0
  let removedHashtagsCount = 0

  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu

  for (const diff of editedDiffs) {
    const origEmojis = (diff.original_content.match(emojiRegex) ?? []).length
    const pubEmojis = (diff.published_content.match(emojiRegex) ?? []).length
    if (pubEmojis > origEmojis + 1) addedEmojisCount++
    if (pubEmojis < origEmojis - 1) removedEmojisCount++

    const origHashtags = (diff.original_content.match(/#\w+/g) ?? []).length
    const pubHashtags = (diff.published_content.match(/#\w+/g) ?? []).length
    if (pubHashtags > origHashtags + 1) addedHashtagsCount++
    if (pubHashtags < origHashtags - 1) removedHashtagsCount++
  }

  if (removedEmojisCount >= Math.ceil(editedDiffs.length * 0.5)) {
    return {
      pattern_type: 'formatting',
      description: 'User removes emojis during editing. Avoid using emojis in drafts.',
      confidence: Math.min(0.9, 0.5 + removedEmojisCount * 0.1),
      source_post_ids: editedDiffs.slice(0, 5).map((d) => d.post_id),
      evidence: [`${removedEmojisCount}/${editedDiffs.length} posts had emojis removed`],
    }
  }

  if (addedEmojisCount >= Math.ceil(editedDiffs.length * 0.5)) {
    return {
      pattern_type: 'formatting',
      description: 'User adds emojis during editing. Include relevant emojis in drafts.',
      confidence: Math.min(0.85, 0.5 + addedEmojisCount * 0.1),
      source_post_ids: editedDiffs.slice(0, 5).map((d) => d.post_id),
      evidence: [`${addedEmojisCount}/${editedDiffs.length} posts had emojis added`],
    }
  }

  if (removedHashtagsCount >= Math.ceil(editedDiffs.length * 0.5)) {
    return {
      pattern_type: 'formatting',
      description: 'User removes hashtags during editing. Minimize or omit hashtags in drafts.',
      confidence: Math.min(0.85, 0.5 + removedHashtagsCount * 0.1),
      source_post_ids: editedDiffs.slice(0, 5).map((d) => d.post_id),
      evidence: [`${removedHashtagsCount}/${editedDiffs.length} posts had hashtags removed`],
    }
  }

  if (addedHashtagsCount >= Math.ceil(editedDiffs.length * 0.5)) {
    return {
      pattern_type: 'formatting',
      description: 'User adds hashtags during editing. Include 2-3 relevant hashtags in drafts.',
      confidence: Math.min(0.85, 0.5 + addedHashtagsCount * 0.1),
      source_post_ids: editedDiffs.slice(0, 5).map((d) => d.post_id),
      evidence: [`${addedHashtagsCount}/${editedDiffs.length} posts had hashtags added`],
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Core Analysis
// ---------------------------------------------------------------------------

/**
 * Analyze a set of post diffs to identify editing patterns.
 * Requires at least MIN_DIFFS_FOR_ANALYSIS diffs.
 */
export function analyzeEditPatterns(diffs: DiffRecord[]): AnalysisResult {
  const noEditCount = diffs.filter((d) => d.edit_type === 'no_edit').length
  const minorEditCount = diffs.filter((d) => d.edit_type === 'minor_edit').length
  const majorEditCount = diffs.filter((d) => d.edit_type === 'major_edit').length

  const patterns: EditPattern[] = []

  // Run all detectors
  const tonePattern = detectTonePatterns(diffs)
  if (tonePattern) patterns.push(tonePattern)

  const structurePattern = detectStructurePatterns(diffs)
  if (structurePattern) patterns.push(structurePattern)

  const lengthPattern = detectLengthPatterns(diffs)
  if (lengthPattern) patterns.push(lengthPattern)

  const formattingPattern = detectFormattingPatterns(diffs)
  if (formattingPattern) patterns.push(formattingPattern)

  // Track no-edit (approval without edit) as a positive voice match signal
  if (noEditCount >= Math.ceil(diffs.length * 0.5)) {
    patterns.push({
      pattern_type: 'tone_shift',
      description: `${noEditCount}/${diffs.length} posts were approved without edits — Scribe is matching the user\'s voice well.`,
      confidence: Math.min(0.95, 0.6 + noEditCount * 0.05),
      source_post_ids: diffs
        .filter((d) => d.edit_type === 'no_edit')
        .slice(0, 5)
        .map((d) => d.post_id),
      evidence: [`${noEditCount} posts approved as-is`],
    })
  }

  // Sort by confidence descending, cap at MAX_OBSERVATIONS_PER_RUN
  patterns.sort((a, b) => b.confidence - a.confidence)

  return {
    patterns: patterns.slice(0, MAX_OBSERVATIONS_PER_RUN),
    no_edit_count: noEditCount,
    minor_edit_count: minorEditCount,
    major_edit_count: majorEditCount,
    total_diffs: diffs.length,
  }
}

// ---------------------------------------------------------------------------
// Database Operations
// ---------------------------------------------------------------------------

/**
 * Fetch all post diffs for a user in an organization.
 */
export async function getAllDiffs(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<DiffRecord[]> {
  const { data, error } = await supabase
    .from('post_diffs')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[voice-analysis] Error fetching diffs:', error)
    return []
  }

  return data ?? []
}

/**
 * Create voice observations from detected patterns.
 * Skips patterns that duplicate existing pending/confirmed observations.
 */
export async function createObservations(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  agentId: string,
  patterns: EditPattern[],
): Promise<number> {
  if (patterns.length === 0) return 0

  // Fetch existing non-dismissed observations to avoid duplicates
  const { data: existing } = await supabase
    .from('voice_observations')
    .select('observation')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .in('status', ['pending', 'confirmed'])

  const existingTexts = new Set((existing ?? []).map((o: { observation: string }) => o.observation))

  const newObservations = patterns
    .filter((p) => !existingTexts.has(p.description))
    .map((p) => ({
      organization_id: organizationId,
      user_id: userId,
      observation: p.description,
      confidence: p.confidence,
      status: 'pending' as const,
      source_post_ids: p.source_post_ids,
      created_by_agent_id: agentId,
    }))

  if (newObservations.length === 0) return 0

  const { error } = await supabase
    .from('voice_observations')
    .insert(newObservations)

  if (error) {
    console.error('[voice-analysis] Error creating observations:', error)
    return 0
  }

  return newObservations.length
}

/**
 * Get confirmed observations for a user as "Learned Preferences" text.
 * This is what Scribe reads when creating drafts.
 */
export async function getLearnedPreferences(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('voice_observations')
    .select('observation, confirmed_at')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .order('confirmed_at', { ascending: true })

  if (error) {
    console.error('[voice-analysis] Error fetching learned preferences:', error)
    return null
  }

  if (!data || data.length === 0) return null

  return data.map((o: { observation: string }) => `- ${o.observation}`).join('\n')
}

/**
 * Create a post diff record when a post is published.
 * Compares the original Scribe draft (first revision) against the published content.
 */
export async function createPostDiff(
  supabase: SupabaseClient,
  postId: string,
  organizationId: string,
  userId: string,
  originalContent: string,
  publishedContent: string,
): Promise<boolean> {
  const editType = categorizeEdit(originalContent, publishedContent)
  const changeSummary = generateChangeSummary(originalContent, publishedContent)

  const { error } = await supabase
    .from('post_diffs')
    .insert({
      post_id: postId,
      organization_id: organizationId,
      user_id: userId,
      original_content: originalContent,
      published_content: publishedContent,
      edit_type: editType,
      change_summary: changeSummary,
    })

  if (error) {
    console.error('[voice-analysis] Error creating post diff:', error)
    return false
  }

  return true
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function averageSentenceLength(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  if (sentences.length === 0) return 0
  const totalWords = sentences.reduce(
    (sum, s) => sum + s.trim().split(/\s+/).length,
    0,
  )
  return totalWords / sentences.length
}
