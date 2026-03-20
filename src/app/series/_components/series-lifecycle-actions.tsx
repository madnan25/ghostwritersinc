'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pause, X, CheckCircle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SeriesStatus } from '@/lib/types'

interface SeriesLifecycleActionsProps {
  seriesId: string
  status: SeriesStatus
  totalParts: number
  currentParts: number
}

export function SeriesLifecycleActions({
  seriesId,
  status,
  totalParts,
  currentParts,
}: SeriesLifecycleActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)

  async function callAction(action: 'pause' | 'cancel' | 'complete' | 'add-post') {
    setActionError(null)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/series/${seriesId}/${action}`, { method: 'POST' })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error ?? `Failed: ${res.status}`)
        }
        router.refresh()
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  const canPause = status === 'active'
  const canResume = status === 'paused'
  const canCancel = status === 'active' || status === 'paused' || status === 'planning'
  const canComplete = status === 'active' || status === 'paused'
  const canAddPost = (status === 'active' || status === 'planning') && currentParts < 8

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canAddPost && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => callAction('add-post')}
          disabled={isPending}
          className="gap-1.5"
        >
          <Plus className="size-3.5" />
          Add Post
          {currentParts >= totalParts && (
            <span className="text-xs text-muted-foreground">({8 - currentParts} remaining)</span>
          )}
        </Button>
      )}

      {canPause && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => callAction('pause')}
          disabled={isPending}
          className="gap-1.5 text-orange-400 hover:text-orange-300 hover:border-orange-500/50"
        >
          <Pause className="size-3.5" />
          Pause
        </Button>
      )}

      {canResume && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => callAction('pause')}
          disabled={isPending}
          className="gap-1.5"
        >
          Resume
        </Button>
      )}

      {canComplete && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => callAction('complete')}
          disabled={isPending}
          className="gap-1.5 text-green-400 hover:text-green-300 hover:border-green-500/50"
        >
          <CheckCircle className="size-3.5" />
          Complete
        </Button>
      )}

      {canCancel && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => callAction('cancel')}
          disabled={isPending}
          className="gap-1.5 text-destructive hover:text-destructive hover:border-destructive/50"
        >
          <X className="size-3.5" />
          Cancel
        </Button>
      )}

      {actionError && (
        <p className="w-full text-xs text-destructive">{actionError}</p>
      )}
    </div>
  )
}
