// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
  categorizeEdit,
  generateChangeSummary,
  analyzeEditPatterns,
  MIN_DIFFS_FOR_ANALYSIS,
} from '@/lib/voice-analysis'
import type { DiffEditType } from '@/lib/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DiffOverrides {
  id?: string
  post_id?: string
  organization_id?: string
  user_id?: string
  original_content?: string
  published_content?: string
  edit_type?: DiffEditType
  change_summary?: string | null
  created_at?: string
}

function makeDiff(overrides: DiffOverrides = {}) {
  const original = overrides.original_content ?? 'This is the original draft content.'
  const published = overrides.published_content ?? original
  return {
    id: overrides.id ?? crypto.randomUUID(),
    post_id: overrides.post_id ?? crypto.randomUUID(),
    organization_id: overrides.organization_id ?? 'org-1',
    user_id: overrides.user_id ?? 'user-1',
    original_content: original,
    published_content: published,
    edit_type: overrides.edit_type ?? categorizeEdit(original, published),
    change_summary: overrides.change_summary ?? null,
    created_at: overrides.created_at ?? new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// categorizeEdit
// ---------------------------------------------------------------------------

describe('categorizeEdit', () => {
  it('returns no_edit when content is identical', () => {
    const content = 'Hello world, this is a test post.'
    expect(categorizeEdit(content, content)).toBe('no_edit')
  })

  it('returns no_edit when only whitespace differs', () => {
    expect(categorizeEdit('Hello world  ', '  Hello world')).toBe('no_edit')
  })

  it('returns minor_edit for small changes (<20% of lines)', () => {
    const original = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10'
    const published = 'Line 1 modified\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10'
    expect(categorizeEdit(original, published)).toBe('minor_edit')
  })

  it('returns major_edit for significant changes (>=20% of lines)', () => {
    const original = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5'
    const published = 'Changed 1\nChanged 2\nLine 3\nLine 4\nLine 5'
    expect(categorizeEdit(original, published)).toBe('major_edit')
  })

  it('returns major_edit when content is completely different', () => {
    expect(categorizeEdit('Original content here', 'Completely different text')).toBe('major_edit')
  })
})

// ---------------------------------------------------------------------------
// generateChangeSummary
// ---------------------------------------------------------------------------

describe('generateChangeSummary', () => {
  it('returns "No edits" for identical content', () => {
    const content = 'Same content'
    const summary = generateChangeSummary(content, content)
    expect(summary).toContain('No edits')
  })

  it('detects content lengthening', () => {
    const original = 'Short post.'
    const published = 'Short post. Now with much more additional content that was added during the review process to make it more comprehensive.'
    const summary = generateChangeSummary(original, published)
    expect(summary).toContain('lengthened')
  })

  it('detects content shortening', () => {
    const original = 'This is a very long original post with lots of content that goes on and on about various topics and trends.'
    const published = 'Short version.'
    const summary = generateChangeSummary(original, published)
    expect(summary).toContain('shortened')
  })

  it('detects paragraph changes', () => {
    const original = 'First paragraph.\n\nSecond paragraph.'
    const published = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.\n\nFourth paragraph.'
    const summary = generateChangeSummary(original, published)
    expect(summary).toContain('Paragraphs')
  })

  it('returns "Minor textual edits" for small changes without structural differences', () => {
    const original = 'Hello world.'
    const published = 'Hello there.'
    const summary = generateChangeSummary(original, published)
    expect(summary).toBe('Minor textual edits')
  })
})

// ---------------------------------------------------------------------------
// analyzeEditPatterns — threshold enforcement
// ---------------------------------------------------------------------------

describe('analyzeEditPatterns — threshold', () => {
  it('requires at least MIN_DIFFS_FOR_ANALYSIS diffs', () => {
    expect(MIN_DIFFS_FOR_ANALYSIS).toBe(5)
  })

  it('returns counts even with few diffs', () => {
    const diffs = [
      makeDiff({ edit_type: 'no_edit' }),
      makeDiff({ edit_type: 'minor_edit' }),
    ]
    const result = analyzeEditPatterns(diffs)
    expect(result.total_diffs).toBe(2)
    expect(result.no_edit_count).toBe(1)
    expect(result.minor_edit_count).toBe(1)
    expect(result.major_edit_count).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// analyzeEditPatterns — no_edit positive signal
// ---------------------------------------------------------------------------

describe('analyzeEditPatterns — approval without edit', () => {
  it('detects high no-edit rate as positive voice match', () => {
    const diffs = Array.from({ length: 6 }, () =>
      makeDiff({ edit_type: 'no_edit' }),
    )
    const result = analyzeEditPatterns(diffs)
    const noEditPattern = result.patterns.find((p) =>
      p.description.includes('approved without edits'),
    )
    expect(noEditPattern).toBeDefined()
    expect(noEditPattern!.confidence).toBeGreaterThan(0.5)
  })

  it('does not flag no-edit pattern when minority of posts are unedited', () => {
    const diffs = [
      makeDiff({ edit_type: 'no_edit' }),
      ...Array.from({ length: 5 }, () =>
        makeDiff({ edit_type: 'major_edit' }),
      ),
    ]
    const result = analyzeEditPatterns(diffs)
    const noEditPattern = result.patterns.find((p) =>
      p.description.includes('approved without edits'),
    )
    expect(noEditPattern).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// analyzeEditPatterns — length patterns
// ---------------------------------------------------------------------------

describe('analyzeEditPatterns — length patterns', () => {
  it('detects consistent shortening', () => {
    const diffs = Array.from({ length: 6 }, () =>
      makeDiff({
        original_content: 'This is a long original post with lots of content that goes on and on about various interesting topics and trends in the industry.',
        published_content: 'Short version of the post.',
        edit_type: 'major_edit',
      }),
    )
    const result = analyzeEditPatterns(diffs)
    const lengthPattern = result.patterns.find((p) => p.pattern_type === 'length_adjustment')
    expect(lengthPattern).toBeDefined()
    expect(lengthPattern!.description).toContain('trims')
  })

  it('detects consistent lengthening', () => {
    const diffs = Array.from({ length: 6 }, () =>
      makeDiff({
        original_content: 'Short draft.',
        published_content: 'This is the expanded version with much more detailed content covering all the key points that were missing from the original draft.',
        edit_type: 'major_edit',
      }),
    )
    const result = analyzeEditPatterns(diffs)
    const lengthPattern = result.patterns.find((p) => p.pattern_type === 'length_adjustment')
    expect(lengthPattern).toBeDefined()
    expect(lengthPattern!.description).toContain('adds more content')
  })
})

// ---------------------------------------------------------------------------
// analyzeEditPatterns — tone patterns
// ---------------------------------------------------------------------------

describe('analyzeEditPatterns — tone patterns', () => {
  it('detects sentence shortening trend', () => {
    const diffs = Array.from({ length: 6 }, () =>
      makeDiff({
        original_content:
          'This is a very long sentence that goes on and on about many different things. ' +
          'Here is another extremely verbose sentence that could probably be shortened significantly. ' +
          'And yet another lengthy sentence that the user will edit to be more concise and direct.',
        published_content:
          'Short point. Quick take. Direct message.',
        edit_type: 'major_edit',
      }),
    )
    const result = analyzeEditPatterns(diffs)
    const tonePattern = result.patterns.find(
      (p) => p.pattern_type === 'tone_shift' && p.description.includes('shortens sentences'),
    )
    expect(tonePattern).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// analyzeEditPatterns — structure patterns
// ---------------------------------------------------------------------------

describe('analyzeEditPatterns — structure patterns', () => {
  it('detects list addition pattern', () => {
    const diffs = Array.from({ length: 6 }, () =>
      makeDiff({
        original_content:
          'AI is transforming content creation. It helps with ideation and drafting. It also assists with editing.',
        published_content:
          'AI is transforming content creation:\n- Helps with ideation\n- Assists with drafting\n- Supports editing\n- Enables scaling',
        edit_type: 'major_edit',
      }),
    )
    const result = analyzeEditPatterns(diffs)
    const structPattern = result.patterns.find(
      (p) => p.pattern_type === 'structure_change' && p.description.includes('bullet lists'),
    )
    expect(structPattern).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// analyzeEditPatterns — formatting patterns
// ---------------------------------------------------------------------------

describe('analyzeEditPatterns — formatting patterns', () => {
  it('detects emoji removal pattern', () => {
    const diffs = Array.from({ length: 6 }, () =>
      makeDiff({
        original_content: 'Great news! 🎉🚀 We just launched our new feature! 💪 Check it out! 🔥',
        published_content: 'Great news! We just launched our new feature. Check it out.',
        edit_type: 'minor_edit',
      }),
    )
    const result = analyzeEditPatterns(diffs)
    const fmtPattern = result.patterns.find(
      (p) => p.pattern_type === 'formatting' && p.description.includes('emoji'),
    )
    expect(fmtPattern).toBeDefined()
    expect(fmtPattern!.description).toContain('Avoid')
  })

  it('detects hashtag removal pattern', () => {
    const diffs = Array.from({ length: 6 }, () =>
      makeDiff({
        original_content: 'AI is changing everything. #AI #MachineLearning #Innovation #Tech #Future',
        published_content: 'AI is changing everything.',
        edit_type: 'minor_edit',
      }),
    )
    const result = analyzeEditPatterns(diffs)
    const fmtPattern = result.patterns.find(
      (p) => p.pattern_type === 'formatting' && p.description.includes('hashtag'),
    )
    expect(fmtPattern).toBeDefined()
    expect(fmtPattern!.description).toContain('Minimize')
  })
})

// ---------------------------------------------------------------------------
// analyzeEditPatterns — result shape
// ---------------------------------------------------------------------------

describe('analyzeEditPatterns — result shape', () => {
  it('returns correct structure', () => {
    const diffs = Array.from({ length: 5 }, (_, i) =>
      makeDiff({
        edit_type: i < 3 ? 'no_edit' : 'minor_edit',
      }),
    )
    const result = analyzeEditPatterns(diffs)
    expect(result).toHaveProperty('patterns')
    expect(result).toHaveProperty('no_edit_count')
    expect(result).toHaveProperty('minor_edit_count')
    expect(result).toHaveProperty('major_edit_count')
    expect(result).toHaveProperty('total_diffs')
    expect(Array.isArray(result.patterns)).toBe(true)
    expect(result.total_diffs).toBe(5)
  })

  it('caps patterns at 5', () => {
    // Create a scenario that could trigger many patterns
    const diffs = Array.from({ length: 10 }, () =>
      makeDiff({ edit_type: 'major_edit' }),
    )
    const result = analyzeEditPatterns(diffs)
    expect(result.patterns.length).toBeLessThanOrEqual(5)
  })

  it('sorts patterns by confidence descending', () => {
    const diffs = Array.from({ length: 8 }, () =>
      makeDiff({
        original_content:
          'Very long wordy sentence that keeps going on and on. Another really long sentence here. Yet more verbose text.',
        published_content: 'Short. Quick. Done.',
        edit_type: 'major_edit',
      }),
    )
    const result = analyzeEditPatterns(diffs)
    for (let i = 1; i < result.patterns.length; i++) {
      expect(result.patterns[i - 1].confidence).toBeGreaterThanOrEqual(
        result.patterns[i].confidence,
      )
    }
  })
})
