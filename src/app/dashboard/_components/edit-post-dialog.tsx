'use client'

import { useTransition, useRef, useState, useEffect } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { updatePostContent } from '@/app/actions/posts'
import { cn } from '@/lib/utils'

interface EditPostDialogProps {
  postId: string
  initialContent: string
}

export function EditPostDialog({ postId, initialContent }: EditPostDialogProps) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState(initialContent)
  const [isPending, startTransition] = useTransition()
  const [mobile, setMobile] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  function handleOpen() {
    setContent(initialContent)
    setOpen(true)
  }

  function handleClose() {
    if (isPending) return
    setOpen(false)
  }

  function handleSave() {
    if (!content.trim()) return
    startTransition(async () => {
      await updatePostContent(postId, content.trim())
      setOpen(false)
    })
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleOpen} className="min-h-[44px] px-4 sm:min-h-0">
        Edit
      </Button>

      <AnimatePresence>
        {open && (
          <m.div
            ref={overlayRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => { if (e.target === overlayRef.current) handleClose() }}
            className={cn(
              'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex',
              mobile ? 'items-end' : 'items-center justify-center p-4',
            )}
          >
            <m.div
              onClick={(e) => e.stopPropagation()}
              initial={mobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 8 }}
              animate={mobile
                ? { y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } }
                : { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] } }
              }
              exit={mobile
                ? { y: '100%', transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }
                : { opacity: 0, scale: 0.95, y: 8, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }
              }
              className={cn(
                'w-full bg-card border-border shadow-2xl',
                mobile
                  ? 'rounded-t-3xl border-t px-5 pt-3'
                  : 'max-w-2xl rounded-xl border p-6',
              )}
              style={
                mobile
                  ? { paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }
                  : undefined
              }
            >
              {/* Drag handle — mobile only */}
              {mobile && (
                <div className="mb-4 flex justify-center">
                  <div className="h-1 w-9 rounded-full bg-muted-foreground/30" />
                </div>
              )}

              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold">Edit Post</h2>
                  {!mobile && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Make changes to the post content below.
                    </p>
                  )}
                </div>
                {mobile && (
                  <button
                    onClick={handleClose}
                    className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95 transition-transform"
                    aria-label="Close"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={mobile ? 8 : 10}
                className={cn(
                  'w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm leading-relaxed',
                  'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50',
                )}
              />

              <div className={cn('mt-4 flex gap-3', mobile ? 'flex-col' : 'flex-row justify-end')}>
                <Button
                  onClick={handleSave}
                  disabled={isPending || !content.trim()}
                  className={mobile ? 'h-[52px] rounded-xl text-base' : ''}
                  size={mobile ? 'default' : 'sm'}
                >
                  {isPending ? 'Saving…' : 'Save Changes'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  disabled={isPending}
                  className={mobile ? 'h-[52px] rounded-xl text-base' : ''}
                  size={mobile ? 'default' : 'sm'}
                >
                  Cancel
                </Button>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  )
}
