'use client'

import { useTransition, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { m, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { deletePost } from '@/app/actions/posts'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useModalPortal } from '@/hooks/use-modal-portal'
import { cn } from '@/lib/utils'

interface DeletePostDialogProps {
  postId: string
  /** After deletion, redirect to this path. Defaults to '/dashboard'. */
  redirectTo?: string
  className?: string
}

export function DeletePostDialog({ postId, redirectTo = '/dashboard', className }: DeletePostDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const mobile = useMediaQuery('(max-width: 767px)')
  const overlayRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const mounted = useModalPortal(open)

  function handleClose() {
    if (isPending) return
    setOpen(false)
  }

  function handleDelete() {
    startTransition(async () => {
      await deletePost(postId)
      setOpen(false)
      router.push(redirectTo)
    })
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn(
          'border-destructive/40 text-destructive/80 hover:border-destructive hover:bg-destructive/10 hover:text-destructive',
          className,
        )}
      >
        Delete
      </Button>

      {mounted
        ? createPortal(
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
                    'fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex',
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
                        : 'max-w-sm rounded-xl border p-6',
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

              <div className="mb-5">
                <h2 className="text-base font-semibold">Delete post?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Are you sure? This cannot be undone.
                </p>
              </div>

              <div className={cn('flex gap-3', mobile ? 'flex-col' : 'flex-row justify-end')}>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isPending}
                  className={mobile ? 'h-[52px] rounded-xl text-base' : ''}
                  size={mobile ? 'default' : 'sm'}
                >
                  {isPending ? 'Deleting…' : 'Delete'}
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
            </AnimatePresence>,
            document.body
          )
        : null}
    </>
  )
}
