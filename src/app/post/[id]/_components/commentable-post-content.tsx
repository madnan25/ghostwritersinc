'use client'

import { useState, useRef, useTransition, useEffect } from 'react'
import { addPostComment } from '@/app/actions/posts'
import { ModalDialog } from '@/components/ui/modal-dialog'
import type { PostComment } from '@/lib/types'

interface Props {
  postId: string
  content: string
  comments: PostComment[]
  postStatus: string
}

interface SelectionState {
  start: number
  end: number
  text: string
  x: number
  y: number
}

interface Segment {
  text: string
  highlighted: boolean
  comment?: PostComment
}

function buildSegments(content: string, inlineComments: PostComment[]): Segment[] {
  const valid = inlineComments
    .filter((c) => c.selection_start !== null && c.selection_end !== null)
    .sort((a, b) => a.selection_start! - b.selection_start!)

  if (valid.length === 0) return [{ text: content, highlighted: false }]

  const segments: Segment[] = []
  let cursor = 0

  for (const comment of valid) {
    const start = comment.selection_start!
    const end = comment.selection_end!

    if (start > cursor) {
      segments.push({ text: content.slice(cursor, start), highlighted: false })
    }
    const segStart = Math.max(cursor, start)
    if (end > segStart) {
      segments.push({ text: content.slice(segStart, end), highlighted: true, comment })
    }
    cursor = Math.max(cursor, end)
  }

  if (cursor < content.length) {
    segments.push({ text: content.slice(cursor), highlighted: false })
  }

  return segments
}

export function CommentablePostContent({ postId, content, comments, postStatus }: Props) {
  const [selection, setSelection] = useState<SelectionState | null>(null)
  const [commentText, setCommentText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showWarning, setShowWarning] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelection(null)
    }
    if (selection) document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selection])

  const inlineComments = comments.filter(
    (c) => c.selection_start !== null && c.selection_end !== null,
  )
  const segments = buildSegments(content, inlineComments)

  function handleMouseUp() {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      return
    }

    const range = sel.getRangeAt(0)
    const contentDiv = contentRef.current
    if (!contentDiv || !contentDiv.contains(range.commonAncestorContainer)) {
      return
    }

    // Calculate character offsets within the content string
    const preCaretRange = range.cloneRange()
    preCaretRange.selectNodeContents(contentDiv)
    preCaretRange.setEnd(range.startContainer, range.startOffset)
    const start = preCaretRange.toString().length

    preCaretRange.setEnd(range.endContainer, range.endOffset)
    const end = preCaretRange.toString().length

    if (start === end) return

    const rect = range.getBoundingClientRect()
    const containerRect = contentDiv.getBoundingClientRect()

    setSelection({
      start,
      end,
      text: sel.toString(),
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top,
    })
    setCommentText('')
  }

  function handleSubmit() {
    if (!commentText.trim() || !selection) return
    if (postStatus === 'approved') {
      setShowWarning(true)
      return
    }
    doSubmit()
  }

  function doSubmit() {
    if (!selection) return
    setShowWarning(false)
    setError(null)
    startTransition(async () => {
      try {
        await addPostComment(postId, commentText.trim(), selection.text, selection.start, selection.end)
        setSelection(null)
        setCommentText('')
      } catch {
        setError('Failed to save comment. Please try again.')
      }
    })
  }

  return (
    <div className="relative">
      {/* Post content with highlights */}
      <div
        ref={contentRef}
        onMouseUp={handleMouseUp}
        className="select-text cursor-text whitespace-pre-wrap text-sm leading-relaxed text-foreground"
      >
        {segments.map((seg, i) =>
          seg.highlighted ? (
            <mark
              key={i}
              className="rounded-sm bg-amber-400/25 px-0.5 text-foreground"
              title={seg.comment?.body}
            >
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
      </div>

      {/* Warning dialog for approved post reversion */}
      <ModalDialog open={showWarning} onClose={() => setShowWarning(false)} titleId="inline-revert-warning-title">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
          <h2 id="inline-revert-warning-title" className="mb-2 text-base font-semibold text-foreground">
            Revert approved post?
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Commenting on this approved post will revert it to review status. The AI team will re-review based on your feedback before it can be re-approved.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowWarning(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={doSubmit}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Comment &amp; Revert
            </button>
          </div>
        </div>
      </ModalDialog>

      {/* Inline selection popover */}
      {selection && (
        <div
          className="absolute z-10 -translate-x-1/2 -translate-y-full"
          style={{ left: selection.x, top: selection.y - 8 }}
        >
          <div className="w-64 rounded-lg border border-border bg-card p-3 shadow-xl">
            <p className="mb-2 truncate text-xs text-muted-foreground">&ldquo;{selection.text}&rdquo;</p>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add inline comment…"
              rows={2}
              autoFocus
              className="w-full resize-none rounded border border-input bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50"
            />
            {error && (
              <p className="mt-1 text-xs text-destructive">{error}</p>
            )}
            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={() => setSelection(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending || !commentText.trim()}
                className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
              >
                {isPending ? 'Saving…' : 'Comment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
