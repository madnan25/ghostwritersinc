'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { publishPost } from '@/app/actions/posts'
import { cn } from '@/lib/utils'

interface Props {
  postId: string
  status: string
}

export function PostNowButton({ postId, status }: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const overlayRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  function handleClose() {
    if (isPending) return
    setOpen(false)
    setError(null)
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    if (open) document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (status !== 'approved') return null

  function handleOpen() {
    setError(null)
    setOpen(true)
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) handleClose()
  }

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      try {
        await publishPost(postId)
        setOpen(false)
        router.push('/dashboard')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to publish. Please try again.')
      }
    })
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className={cn(
          'rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white',
          'transition-opacity hover:opacity-90',
        )}
      >
        Post to LinkedIn
      </button>

      {open && (
        <div
          ref={overlayRef}
          onClick={handleOverlayClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby="post-now-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h2 id="post-now-dialog-title" className="text-base font-semibold">Publish to LinkedIn?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This will post the content to your LinkedIn profile immediately and cannot be undone.
            </p>

            {error && (
              <div className="mt-3 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={handleClose}
                disabled={isPending}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {isPending ? 'Publishing…' : 'Yes, post now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
