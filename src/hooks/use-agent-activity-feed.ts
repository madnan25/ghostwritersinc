'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AgentActivityLog } from '@/lib/types'

/**
 * Subscribe to realtime inserts on `agent_activity_log`.
 * Returns the most recent activity entries (capped at `limit`).
 * RLS ensures only the user's org rows are received.
 */
export function useAgentActivityFeed(limit = 50) {
  const [entries, setEntries] = useState<AgentActivityLog[]>([])
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
      .then(({ data }) => {
        if (data) setEntries(data)
      })

    // Subscribe to new inserts
    const channel = supabase
      .channel('agent-activity-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_activity_log' },
        (payload) => {
          const entry = payload.new as AgentActivityLog
          setEntries((prev) => [entry, ...prev].slice(0, limitRef.current))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return entries
}
