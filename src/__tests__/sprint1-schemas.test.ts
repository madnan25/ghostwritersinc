// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

// Replicate the Zod schemas from the API routes for validation testing
const UpsertStrategyConfigSchema = z.object({
  monthly_post_target: z.number().int().min(1).max(100).optional(),
  intel_score_threshold: z.number().min(0).max(1).optional(),
  default_publish_hour: z.number().int().min(0).max(23).optional(),
  voice_notes: z.string().nullable().optional(),
})

const CreateResearchPoolSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  source_url: z.string().url().nullable().optional(),
  source_type: z.string().default('article'),
  pillar_id: z.string().uuid().nullable().optional(),
  relevance_score: z.number().min(0).max(1).nullable().optional(),
  raw_content: z.string().nullable().optional(),
})

const CreateBriefSchema = z.object({
  pillar_id: z.string().uuid().nullable().optional(),
  angle: z.string().min(1, 'Angle is required'),
  research_refs: z.array(z.string().uuid()).default([]),
  voice_notes: z.string().nullable().optional(),
  publish_at: z.string().datetime({ offset: true }).nullable().optional(),
  assigned_agent_id: z.string().uuid().nullable().optional(),
})

describe('Sprint 1: Strategy Config schema validation', () => {
  it('accepts valid full config', () => {
    const result = UpsertStrategyConfigSchema.safeParse({
      monthly_post_target: 12,
      intel_score_threshold: 0.70,
      default_publish_hour: 9,
      voice_notes: 'Keep it professional',
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (all optional)', () => {
    const result = UpsertStrategyConfigSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects monthly_post_target of 0', () => {
    const result = UpsertStrategyConfigSchema.safeParse({
      monthly_post_target: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects monthly_post_target over 100', () => {
    const result = UpsertStrategyConfigSchema.safeParse({
      monthly_post_target: 101,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer monthly_post_target', () => {
    const result = UpsertStrategyConfigSchema.safeParse({
      monthly_post_target: 5.5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects intel_score_threshold below 0', () => {
    const result = UpsertStrategyConfigSchema.safeParse({
      intel_score_threshold: -0.1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects intel_score_threshold above 1', () => {
    const result = UpsertStrategyConfigSchema.safeParse({
      intel_score_threshold: 1.1,
    })
    expect(result.success).toBe(false)
  })

  it('accepts intel_score_threshold boundary values 0 and 1', () => {
    expect(UpsertStrategyConfigSchema.safeParse({ intel_score_threshold: 0 }).success).toBe(true)
    expect(UpsertStrategyConfigSchema.safeParse({ intel_score_threshold: 1 }).success).toBe(true)
  })

  it('rejects default_publish_hour below 0', () => {
    const result = UpsertStrategyConfigSchema.safeParse({
      default_publish_hour: -1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects default_publish_hour above 23', () => {
    const result = UpsertStrategyConfigSchema.safeParse({
      default_publish_hour: 24,
    })
    expect(result.success).toBe(false)
  })

  it('accepts null voice_notes', () => {
    const result = UpsertStrategyConfigSchema.safeParse({
      voice_notes: null,
    })
    expect(result.success).toBe(true)
  })
})

describe('Sprint 1: Research Pool schema validation', () => {
  it('accepts valid item with all fields', () => {
    const result = CreateResearchPoolSchema.safeParse({
      title: 'AI Trends 2026',
      source_url: 'https://example.com/article',
      source_type: 'article',
      pillar_id: '550e8400-e29b-41d4-a716-446655440000',
      relevance_score: 0.85,
      raw_content: 'Some research content...',
    })
    expect(result.success).toBe(true)
  })

  it('accepts minimal item (title only)', () => {
    const result = CreateResearchPoolSchema.safeParse({
      title: 'Quick insight',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.source_type).toBe('article') // default
    }
  })

  it('rejects empty title', () => {
    const result = CreateResearchPoolSchema.safeParse({
      title: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing title', () => {
    const result = CreateResearchPoolSchema.safeParse({
      source_type: 'article',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid source_url', () => {
    const result = CreateResearchPoolSchema.safeParse({
      title: 'Test',
      source_url: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })

  it('accepts null source_url', () => {
    const result = CreateResearchPoolSchema.safeParse({
      title: 'Test',
      source_url: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects relevance_score below 0', () => {
    const result = CreateResearchPoolSchema.safeParse({
      title: 'Test',
      relevance_score: -0.5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects relevance_score above 1', () => {
    const result = CreateResearchPoolSchema.safeParse({
      title: 'Test',
      relevance_score: 1.5,
    })
    expect(result.success).toBe(false)
  })

  it('accepts null relevance_score', () => {
    const result = CreateResearchPoolSchema.safeParse({
      title: 'Test',
      relevance_score: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid pillar_id (not UUID)', () => {
    const result = CreateResearchPoolSchema.safeParse({
      title: 'Test',
      pillar_id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })
})

describe('Sprint 1: Brief schema validation', () => {
  it('accepts valid brief with all fields', () => {
    const result = CreateBriefSchema.safeParse({
      pillar_id: '550e8400-e29b-41d4-a716-446655440000',
      angle: 'Why AI governance matters for LinkedIn thought leadership',
      research_refs: ['550e8400-e29b-41d4-a716-446655440001'],
      voice_notes: 'Keep casual',
      publish_at: '2026-03-25T09:00:00+00:00',
      assigned_agent_id: '550e8400-e29b-41d4-a716-446655440002',
    })
    expect(result.success).toBe(true)
  })

  it('accepts minimal brief (angle only)', () => {
    const result = CreateBriefSchema.safeParse({
      angle: 'Quick post about trends',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.research_refs).toEqual([]) // default
    }
  })

  it('rejects empty angle', () => {
    const result = CreateBriefSchema.safeParse({
      angle: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing angle', () => {
    const result = CreateBriefSchema.safeParse({
      pillar_id: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid UUIDs in research_refs', () => {
    const result = CreateBriefSchema.safeParse({
      angle: 'Test',
      research_refs: ['not-a-uuid'],
    })
    expect(result.success).toBe(false)
  })

  it('accepts empty research_refs array', () => {
    const result = CreateBriefSchema.safeParse({
      angle: 'Test',
      research_refs: [],
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid publish_at format', () => {
    const result = CreateBriefSchema.safeParse({
      angle: 'Test',
      publish_at: '2026-03-25',
    })
    expect(result.success).toBe(false)
  })

  it('accepts null publish_at', () => {
    const result = CreateBriefSchema.safeParse({
      angle: 'Test',
      publish_at: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid assigned_agent_id (not UUID)', () => {
    const result = CreateBriefSchema.safeParse({
      angle: 'Test',
      assigned_agent_id: 'invalid',
    })
    expect(result.success).toBe(false)
  })
})
