'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AgentActivityLog } from '@/lib/types'

const DEFAULT_WINDOW_HOURS = 48

function getWindowStartIso(windowHours: number) {
  return new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()
}

/**
 * Subscribe to realtime inserts on `agent_activity_log`.
 * Returns the most recent activity entries (capped at `limit`).
 * RLS ensures only the user's org rows are received.
 */
export function useAgentActivityFeed(limit = 20, windowHours = DEFAULT_WINDOW_HOURS) {
  const [entries, setEntries] = useState<AgentActivityLog[]>([])
  const limitRef = useRef(limit)
  const windowHoursRef = useRef(windowHours)
  limitRef.current = limit
  windowHoursRef.current = windowHours

  useEffect(() => {
    const supabase = createClient()
    const windowStartIso = getWindowStartIso(windowHoursRef.current)

    // Seed with recent entries
    supabase
      .from('agent_activity_log')
      .select('*')
      .gte('created_at', windowStartIso)
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
          if (new Date(entry.created_at).getTime() < Date.now() - windowHoursRef.current * 60 * 60 * 1000) {
            return
          }

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
