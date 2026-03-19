'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AgentActivityLog } from '@/lib/types'

export type AgentActivityFeedEntry = AgentActivityLog & {
  agent_name?: string | null
  post_title?: string | null
}

function getMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string
): string | null {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

async function enrichEntries(entries: AgentActivityLog[]): Promise<AgentActivityFeedEntry[]> {
  if (entries.length === 0) return []

  const agentIds = Array.from(
    new Set(
      entries
        .filter((entry) => !getMetadataString(entry.metadata, 'agent_name'))
        .map((entry) => entry.agent_id)
        .filter(Boolean)
    )
  )
  const postIds = Array.from(
    new Set(
      entries
        .filter((entry) => entry.post_id && !getMetadataString(entry.metadata, 'post_title'))
        .map((entry) => entry.post_id)
        .filter((value): value is string => Boolean(value))
    )
  )

  if (agentIds.length === 0 && postIds.length === 0) {
    return entries.map((entry) => ({
      ...entry,
      agent_name: getMetadataString(entry.metadata, 'agent_name'),
      post_title: getMetadataString(entry.metadata, 'post_title'),
    }))
  }

  try {
    const response = await fetch('/api/agent-activity/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_ids: agentIds, post_ids: postIds }),
    })

    if (!response.ok) {
      return entries.map((entry) => ({
        ...entry,
        agent_name: getMetadataString(entry.metadata, 'agent_name'),
        post_title: getMetadataString(entry.metadata, 'post_title'),
      }))
    }

    const data = (await response.json()) as {
      agentNames?: Record<string, string | null>
      postTitles?: Record<string, string | null>
    }

    return entries.map((entry) => ({
      ...entry,
      agent_name:
        getMetadataString(entry.metadata, 'agent_name') ??
        data.agentNames?.[entry.agent_id] ??
        null,
      post_title:
        getMetadataString(entry.metadata, 'post_title') ??
        (entry.post_id ? data.postTitles?.[entry.post_id] ?? null : null),
    }))
  } catch {
    return entries.map((entry) => ({
      ...entry,
      agent_name: getMetadataString(entry.metadata, 'agent_name'),
      post_title: getMetadataString(entry.metadata, 'post_title'),
    }))
  }
}

/**
 * Subscribe to realtime inserts on `agent_activity_log`.
 * Returns the most recent activity entries (capped at `limit`).
 * RLS ensures only the user's org rows are received.
 */
export function useAgentActivityFeed(limit = 50) {
  const [entries, setEntries] = useState<AgentActivityFeedEntry[]>([])
  const limitRef = useRef(limit)
  useLayoutEffect(() => {
    limitRef.current = limit
  })

  useEffect(() => {
    const supabase = createClient()

    // Seed with recent entries
    supabase
      .from('agent_activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limitRef.current)
      .then(async ({ data }) => {
        if (data) setEntries(await enrichEntries(data))
      })

    // Subscribe to new inserts
    const channel = supabase
      .channel('agent-activity-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_activity_log' },
        async (payload) => {
          const entry = payload.new as AgentActivityLog
          const [enrichedEntry] = await enrichEntries([entry])
          setEntries((prev) => [enrichedEntry, ...prev].slice(0, limitRef.current))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return entries
}
