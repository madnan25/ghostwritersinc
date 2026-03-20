// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
  formatBriefVersionDocument,
  getBriefStatusLabel,
  getBriefVersionLabel,
} from '@/lib/brief-documents'
import type { BriefVersionWithContext } from '@/lib/types'

const briefVersion: BriefVersionWithContext = {
  id: 'brief-version-1',
  brief_id: 'brief-1',
  organization_id: 'org-1',
  version: 2,
  pillar_id: 'pillar-1',
  angle: 'Why founders should own the customer data layer',
  research_refs: ['research-1'],
  voice_notes: 'Keep this grounded in client operating detail.',
  publish_at: '2026-03-21T09:00:00Z',
  status: 'revision_requested',
  source: 'ai_generated',
  priority: 'normal',
  revision_count: 1,
  revision_notes: 'Sharpen the hook and cut the generic market claim.',
  assigned_agent_id: 'agent-1',
  assigned_agent_name: 'Brad',
  research_items: [{ id: 'research-1', title: 'Bitrix reporting workflow', source_type: 'upload' }],
  linked_post_versions: [2],
  created_at: '2026-03-20T00:00:00Z',
}

describe('brief documents', () => {
  it('formats version and status labels', () => {
    expect(getBriefVersionLabel(2)).toBe('Brief v2')
    expect(getBriefStatusLabel('revision_requested')).toBe('Revision Requested')
  })

  it('builds a readable diffable brief document', () => {
    const formatted = formatBriefVersionDocument(briefVersion)

    expect(formatted).toContain('Brief v2: Why founders should own the customer data layer')
    expect(formatted).toContain('Assigned to: Brad')
    expect(formatted).toContain('Research inputs: Bitrix reporting workflow')
    expect(formatted).toContain('Revision Request')
    expect(formatted).toContain('Sharpen the hook and cut the generic market claim.')
  })
})
