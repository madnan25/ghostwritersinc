// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
  applyTargetedRevisions,
  validateFlaggedSections,
  TARGETED_REVISION_CAP,
  type FlaggedSection,
  type SectionReplacement,
} from '@/lib/targeted-revision'

describe('targeted revision', () => {
  describe('TARGETED_REVISION_CAP', () => {
    it('is 3', () => {
      expect(TARGETED_REVISION_CAP).toBe(3)
    })
  })

  describe('validateFlaggedSections', () => {
    it('returns no errors for valid sections', () => {
      const sections: FlaggedSection[] = [
        { start_char: 0, end_char: 10, note: 'fix this' },
        { start_char: 20, end_char: 30, note: 'fix that' },
      ]
      expect(validateFlaggedSections(sections, 100)).toEqual([])
    })

    it('flags negative start_char', () => {
      const sections: FlaggedSection[] = [
        { start_char: -1, end_char: 10, note: 'x' },
      ]
      const errors = validateFlaggedSections(sections, 100)
      expect(errors).toContainEqual(expect.stringContaining('start_char must be non-negative'))
    })

    it('flags end_char exceeding content length', () => {
      const sections: FlaggedSection[] = [
        { start_char: 0, end_char: 150, note: 'x' },
      ]
      const errors = validateFlaggedSections(sections, 100)
      expect(errors).toContainEqual(expect.stringContaining('exceeds content length'))
    })

    it('flags start_char > end_char', () => {
      const sections: FlaggedSection[] = [
        { start_char: 20, end_char: 10, note: 'x' },
      ]
      const errors = validateFlaggedSections(sections, 100)
      expect(errors).toContainEqual(expect.stringContaining('must be <= end_char'))
    })

    it('flags empty ranges', () => {
      const sections: FlaggedSection[] = [
        { start_char: 10, end_char: 10, note: 'x' },
      ]
      const errors = validateFlaggedSections(sections, 100)
      expect(errors).toContainEqual(expect.stringContaining('empty range'))
    })

    it('flags overlapping sections', () => {
      const sections: FlaggedSection[] = [
        { start_char: 0, end_char: 15, note: 'a' },
        { start_char: 10, end_char: 25, note: 'b' },
      ]
      const errors = validateFlaggedSections(sections, 100)
      expect(errors).toContainEqual(expect.stringContaining('Overlapping'))
    })

    it('allows adjacent (non-overlapping) sections', () => {
      const sections: FlaggedSection[] = [
        { start_char: 0, end_char: 10, note: 'a' },
        { start_char: 10, end_char: 20, note: 'b' },
      ]
      expect(validateFlaggedSections(sections, 100)).toEqual([])
    })
  })

  describe('applyTargetedRevisions', () => {
    it('replaces a single section while preserving surrounding text', () => {
      const content = 'Hello World, this is a test of targeted revision.'
      const replacements: SectionReplacement[] = [
        { start_char: 6, end_char: 11, note: 'capitalize', replacement: 'WORLD' },
      ]

      const result = applyTargetedRevisions(content, replacements)

      expect(result.revisedContent).toBe('Hello WORLD, this is a test of targeted revision.')
      expect(result.diffSections).toHaveLength(1)
      expect(result.diffSections[0]).toEqual({
        start_char: 6,
        end_char: 11,
        before_text: 'World',
        after_text: 'WORLD',
      })
      expect(result.skippedSections).toHaveLength(0)
    })

    it('replaces multiple sections preserving all unflagged text', () => {
      const content = 'The quick brown fox jumps over the lazy dog.'
      const replacements: SectionReplacement[] = [
        { start_char: 4, end_char: 9, note: 'slower', replacement: 'slow' },
        { start_char: 35, end_char: 39, note: 'energize', replacement: 'energetic' },
      ]

      const result = applyTargetedRevisions(content, replacements)

      expect(result.revisedContent).toBe('The slow brown fox jumps over the energetic dog.')
      // Unflagged parts are preserved character-for-character
      expect(result.revisedContent.startsWith('The ')).toBe(true)
      expect(result.revisedContent.includes(' brown fox jumps over the ')).toBe(true)
      expect(result.revisedContent.endsWith(' dog.')).toBe(true)
      expect(result.diffSections).toHaveLength(2)
    })

    it('handles replacements of different lengths', () => {
      const content = 'AB CD EF'
      const replacements: SectionReplacement[] = [
        { start_char: 0, end_char: 2, note: 'expand', replacement: 'ABCDE' },
        { start_char: 6, end_char: 8, note: 'shrink', replacement: 'G' },
      ]

      const result = applyTargetedRevisions(content, replacements)

      expect(result.revisedContent).toBe('ABCDE CD G')
      expect(result.diffSections).toHaveLength(2)
      expect(result.diffSections[0].before_text).toBe('AB')
      expect(result.diffSections[0].after_text).toBe('ABCDE')
      expect(result.diffSections[1].before_text).toBe('EF')
      expect(result.diffSections[1].after_text).toBe('G')
    })

    it('processes sections in correct order regardless of input order', () => {
      const content = 'AABBCC'
      const replacements: SectionReplacement[] = [
        { start_char: 4, end_char: 6, note: 'last', replacement: 'cc' },
        { start_char: 0, end_char: 2, note: 'first', replacement: 'aa' },
      ]

      const result = applyTargetedRevisions(content, replacements)

      expect(result.revisedContent).toBe('aaBBcc')
      // diffSections should be in left-to-right order
      expect(result.diffSections[0].start_char).toBe(0)
      expect(result.diffSections[1].start_char).toBe(4)
    })

    it('skips out-of-bounds sections', () => {
      const content = 'Hello'
      const replacements: SectionReplacement[] = [
        { start_char: 0, end_char: 100, note: 'too long', replacement: 'x' },
      ]

      const result = applyTargetedRevisions(content, replacements)

      expect(result.revisedContent).toBe('Hello')
      expect(result.skippedSections).toHaveLength(1)
      expect(result.skippedSections[0].reason).toContain('Out of bounds')
    })

    it('skips empty-range sections', () => {
      const content = 'Hello'
      const replacements: SectionReplacement[] = [
        { start_char: 3, end_char: 3, note: 'empty', replacement: 'x' },
      ]

      const result = applyTargetedRevisions(content, replacements)

      expect(result.revisedContent).toBe('Hello')
      expect(result.skippedSections).toHaveLength(1)
      expect(result.skippedSections[0].reason).toContain('Empty range')
    })

    it('preserves content when replacement is identical to original', () => {
      const content = 'Hello World'
      const replacements: SectionReplacement[] = [
        { start_char: 6, end_char: 11, note: 'no change', replacement: 'World' },
      ]

      const result = applyTargetedRevisions(content, replacements)

      expect(result.revisedContent).toBe('Hello World')
      expect(result.diffSections[0].before_text).toBe('World')
      expect(result.diffSections[0].after_text).toBe('World')
    })

    it('handles replacement at the very start of content', () => {
      const content = 'Hello World'
      const replacements: SectionReplacement[] = [
        { start_char: 0, end_char: 5, note: 'greet', replacement: 'Hi' },
      ]

      const result = applyTargetedRevisions(content, replacements)

      expect(result.revisedContent).toBe('Hi World')
    })

    it('handles replacement at the very end of content', () => {
      const content = 'Hello World'
      const replacements: SectionReplacement[] = [
        { start_char: 6, end_char: 11, note: 'change', replacement: 'Earth' },
      ]

      const result = applyTargetedRevisions(content, replacements)

      expect(result.revisedContent).toBe('Hello Earth')
    })

    it('handles empty replacement (deletion)', () => {
      const content = 'Hello beautiful World'
      const replacements: SectionReplacement[] = [
        { start_char: 5, end_char: 15, note: 'remove', replacement: '' },
      ]

      const result = applyTargetedRevisions(content, replacements)

      expect(result.revisedContent).toBe('Hello World')
    })
  })
})
