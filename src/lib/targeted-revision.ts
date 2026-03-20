/**
 * Targeted revision logic for the Scribe agent (LIN-454).
 *
 * Processes structured revision payloads — rewrites only flagged char-range
 * sections while preserving all surrounding text character-for-character.
 */

/** Input from the UI: user-flagged section with a revision note. */
export interface FlaggedSection {
  start_char: number
  end_char: number
  note: string
}

/** A single replacement produced by the Scribe agent. */
export interface SectionReplacement {
  start_char: number
  end_char: number
  note: string
  replacement: string
}

/** Diff record stored in post_revisions.diff_sections for UI rendering. */
export interface DiffSection {
  start_char: number
  end_char: number
  before_text: string
  after_text: string
}

/** Result of applying targeted revisions to content. */
export interface TargetedRevisionResult {
  /** The content after applying all replacements. */
  revisedContent: string
  /** Diff data for each section (before/after). */
  diffSections: DiffSection[]
  /** Sections that were skipped (out of bounds or empty). */
  skippedSections: Array<{ section: FlaggedSection; reason: string }>
}

/** Maximum targeted revisions allowed per draft. */
export const TARGETED_REVISION_CAP = 3

/**
 * Validates flagged sections against the current content.
 * Returns errors for invalid entries; does not throw.
 */
export function validateFlaggedSections(
  sections: FlaggedSection[],
  contentLength: number
): string[] {
  const errors: string[] = []

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]

    if (s.start_char < 0) {
      errors.push(`Section ${i}: start_char must be non-negative`)
    }
    if (s.end_char < 0) {
      errors.push(`Section ${i}: end_char must be non-negative`)
    }
    if (s.start_char > s.end_char) {
      errors.push(`Section ${i}: start_char (${s.start_char}) must be <= end_char (${s.end_char})`)
    }
    if (s.end_char > contentLength) {
      errors.push(`Section ${i}: end_char (${s.end_char}) exceeds content length (${contentLength})`)
    }
    if (s.start_char === s.end_char) {
      errors.push(`Section ${i}: empty range (start_char === end_char)`)
    }
  }

  // Check for overlapping sections
  const sorted = [...sections].sort((a, b) => a.start_char - b.start_char)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start_char < sorted[i - 1].end_char) {
      errors.push(
        `Overlapping sections detected: [${sorted[i - 1].start_char}-${sorted[i - 1].end_char}] and [${sorted[i].start_char}-${sorted[i].end_char}]`
      )
    }
  }

  return errors
}

/**
 * Applies targeted revisions to content.
 *
 * Processes replacements in reverse order (right-to-left) so that earlier
 * char offsets remain valid as we splice in replacement text.
 *
 * Core contract: unflagged text is preserved character-for-character.
 */
export function applyTargetedRevisions(
  content: string,
  replacements: SectionReplacement[]
): TargetedRevisionResult {
  const diffSections: DiffSection[] = []
  const skippedSections: Array<{ section: FlaggedSection; reason: string }> = []

  // Sort by start_char descending so we process right-to-left.
  // This ensures earlier offsets stay valid after each splice.
  const sorted = [...replacements].sort((a, b) => b.start_char - a.start_char)

  let result = content

  for (const rep of sorted) {
    // Skip out-of-bounds sections
    if (rep.start_char < 0 || rep.end_char > result.length) {
      skippedSections.push({
        section: { start_char: rep.start_char, end_char: rep.end_char, note: rep.note },
        reason: `Out of bounds: [${rep.start_char}-${rep.end_char}] for content length ${result.length}`,
      })
      continue
    }

    // Skip empty ranges
    if (rep.start_char >= rep.end_char) {
      skippedSections.push({
        section: { start_char: rep.start_char, end_char: rep.end_char, note: rep.note },
        reason: 'Empty range',
      })
      continue
    }

    const beforeText = result.slice(rep.start_char, rep.end_char)

    // Splice in the replacement
    result = result.slice(0, rep.start_char) + rep.replacement + result.slice(rep.end_char)

    diffSections.push({
      start_char: rep.start_char,
      end_char: rep.end_char,
      before_text: beforeText,
      after_text: rep.replacement,
    })
  }

  // Reverse diffSections so they appear in left-to-right order for UI
  diffSections.reverse()

  return { revisedContent: result, diffSections, skippedSections }
}
