'use client'

import { useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Post } from '@/lib/types'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type PostChangeHandler = {
  onInsert?: (post: Post) => void
  onUpdate?: (post: Post) => void
  onDelete?: (old: { id: string }) => void
}

/**
 * Subscribe to realtime postgres_changes on the `posts` table.
 * RLS ensures only the user's org rows are received.
 */
export function usePostsRealtime(handlers: PostChangeHandler) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('posts-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        (payload: RealtimePostgresChangesPayload<Post>) => {
          const h = handlersRef.current
          switch (payload.eventType) {
            case 'INSERT':
              h.onInsert?.(payload.new as Post)
              break
            case 'UPDATE':
              h.onUpdate?.(payload.new as Post)
              break
            case 'DELETE':
              h.onDelete?.(payload.old as { id: string })
              break
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return null
}

/**
 * Convenience hook: keeps a posts array in sync with realtime changes.
 * Returns a stable updater that can be called from a parent useState setter.
 */
export function usePostsRealtimeSync(
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>
) {
  const onInsert = useCallback(
    (post: Post) => setPosts((prev) => [post, ...prev]),
    [setPosts]
  )

  const onUpdate = useCallback(
    (post: Post) =>
      setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p))),
    [setPosts]
  )

  const onDelete = useCallback(
    (old: { id: string }) =>
      setPosts((prev) => prev.filter((p) => p.id !== old.id)),
    [setPosts]
  )

  usePostsRealtime({ onInsert, onUpdate, onDelete })
}
