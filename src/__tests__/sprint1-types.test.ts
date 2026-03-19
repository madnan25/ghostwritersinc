// @vitest-environment node

import { describe, expect, it } from 'vitest'
import type {
  PostStatus,
  StrategyConfig,
  ResearchPoolItem,
  ResearchPoolStatus,
  Brief,
  BriefStatus,
  Post,
} from '@/lib/types'

describe('Sprint 1: Type definitions', () => {
  describe('StrategyConfig interface', () => {
    it('can construct a valid StrategyConfig object', () => {
      const config: StrategyConfig = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        organization_id: '550e8400-e29b-41d4-a716-446655440002',
        monthly_post_target: 12,
        intel_score_threshold: 0.70,
        default_publish_hour: 9,
        voice_notes: 'Keep it professional',
        created_at: '2026-03-19T00:00:00Z',
        updated_at: '2026-03-19T00:00:00Z',
      }
      expect(config.monthly_post_target).toBe(12)
      expect(config.intel_score_threshold).toBe(0.70)
      expect(config.default_publish_hour).toBe(9)
    })

    it('accepts null voice_notes', () => {
      const config: StrategyConfig = {
        id: 'id',
        user_id: 'uid',
        organization_id: 'oid',
        monthly_post_target: 8,
        intel_score_threshold: 0.5,
        default_publish_hour: 14,
        voice_notes: null,
        created_at: '2026-03-19T00:00:00Z',
        updated_at: '2026-03-19T00:00:00Z',
      }
      expect(config.voice_notes).toBeNull()
    })
  })

  describe('ResearchPoolItem interface', () => {
    it('can construct a valid ResearchPoolItem', () => {
      const item: ResearchPoolItem = {
        id: 'item-1',
        organization_id: 'org-1',
        title: 'AI Governance Trends',
        source_url: 'https://example.com/article',
        source_type: 'article',
        pillar_id: 'pillar-1',
        relevance_score: 0.85,
        raw_content: 'Content...',
        status: 'new',
        created_by_agent_id: 'agent-1',
        created_at: '2026-03-19T00:00:00Z',
        updated_at: '2026-03-19T00:00:00Z',
      }
      expect(item.status).toBe('new')
      expect(item.relevance_score).toBe(0.85)
    })

    it('supports consumed status', () => {
      const status: ResearchPoolStatus = 'consumed'
      expect(status).toBe('consumed')
    })

    it('accepts nullable fields', () => {
      const item: ResearchPoolItem = {
        id: 'item-2',
        organization_id: 'org-1',
        title: 'Quick Note',
        source_url: null,
        source_type: 'note',
        pillar_id: null,
        relevance_score: null,
        raw_content: null,
        status: 'new',
        created_by_agent_id: null,
        created_at: '2026-03-19T00:00:00Z',
        updated_at: '2026-03-19T00:00:00Z',
      }
      expect(item.source_url).toBeNull()
      expect(item.pillar_id).toBeNull()
      expect(item.relevance_score).toBeNull()
      expect(item.raw_content).toBeNull()
      expect(item.created_by_agent_id).toBeNull()
    })
  })

  describe('Brief interface', () => {
    it('can construct a valid Brief', () => {
      const brief: Brief = {
        id: 'brief-1',
        organization_id: 'org-1',
        pillar_id: 'pillar-1',
        angle: 'Why AI governance matters',
        research_refs: ['ref-1', 'ref-2'],
        voice_notes: 'Professional tone',
        publish_at: '2026-03-25T09:00:00Z',
        status: 'pending',
        revision_count: 0,
        revision_notes: null,
        assigned_agent_id: 'agent-1',
        created_at: '2026-03-19T00:00:00Z',
        updated_at: '2026-03-19T00:00:00Z',
      }
      expect(brief.status).toBe('pending')
      expect(brief.revision_count).toBe(0)
      expect(brief.research_refs).toHaveLength(2)
    })

    it('supports all BriefStatus values', () => {
      const statuses: BriefStatus[] = ['pending', 'in_review', 'revision_requested', 'done']
      expect(statuses).toHaveLength(4)
    })

    it('accepts nullable fields', () => {
      const brief: Brief = {
        id: 'brief-2',
        organization_id: 'org-1',
        pillar_id: null,
        angle: 'Quick thought',
        research_refs: [],
        voice_notes: null,
        publish_at: null,
        status: 'pending',
        revision_count: 0,
        revision_notes: null,
        assigned_agent_id: null,
        created_at: '2026-03-19T00:00:00Z',
        updated_at: '2026-03-19T00:00:00Z',
      }
      expect(brief.pillar_id).toBeNull()
      expect(brief.assigned_agent_id).toBeNull()
    })
  })

  describe('Post interface — Sprint 1 additions', () => {
    it('includes revision_count field', () => {
      const post: Partial<Post> = {
        revision_count: 2,
      }
      expect(post.revision_count).toBe(2)
    })

    it('includes brief_id field', () => {
      const post: Partial<Post> = {
        brief_id: 'brief-1',
      }
      expect(post.brief_id).toBe('brief-1')
    })

    it('brief_id can be null', () => {
      const post: Partial<Post> = {
        brief_id: null,
      }
      expect(post.brief_id).toBeNull()
    })

    it('publish_failed is a valid PostStatus', () => {
      const status: PostStatus = 'publish_failed'
      expect(status).toBe('publish_failed')
    })
  })
})
