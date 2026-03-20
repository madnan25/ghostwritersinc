'use client'

import { useState, useRef, useEffect } from 'react'
import { Flag, X } from 'lucide-react'

export interface FlaggedAnnotation {
  id: string
  start: number
  end: number
  text: string
  note: string
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
  flagged: boolean
  annotationId?: string
}

function buildSegments(content: string, annotations: FlaggedAnnotation[]): Segment[] {
  if (annotations.length === 0) return [{ text: content, flagged: false }]

  const sorted = [...annotations].sort((a, b) => a.start - b.start)
  const segments: Segment[] = []
  let cursor = 0

  for (const ann of sorted) {
    const start = Math.max(ann.start, cursor)
    const end = ann.end
    if (start > cursor) {
      segments.push({ text: content.slice(cursor, start), flagged: false })
    }
    if (end > start) {
      segments.push({ text: content.slice(start, end), flagged: true, annotationId: ann.id })
    }
    cursor = Math.max(cursor, end)
  }

  if (cursor < content.length) {
    segments.push({ text: content.slice(cursor), flagged: false })
  }

  return segments
}

interface Props {
  content: string
  annotations: FlaggedAnnotation[]
  maxAnnotations: number
  onAdd: (annotation: FlaggedAnnotation) => void
  onRemove: (id: string) => void
}

export function AnnotatablePostContent({ content, annotations, maxAnnotations, onAdd, onRemove }: Props) {
  const [selection, setSelection] = useState<SelectionState | null>(null)
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteText, setNoteText] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)
  const atMax = annotations.length >= maxAnnotations

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelection(null)
        setShowNoteInput(false)
        setNoteText('')
      }
    }
    if (selection) document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selection])

  function handleMouseUp() {
    if (atMax) return

    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return

    const range = sel.getRangeAt(0)
    const contentDiv = contentRef.current
    if (!contentDiv || !contentDiv.contains(range.commonAncestorContainer)) return

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
    setShowNoteInput(false)
    setNoteText('')
  }

  function handleFlagClick() {
    setShowNoteInput(true)
  }

  function handleSubmitNote() {
    if (!selection) return
    onAdd({
      id: crypto.randomUUID(),
      start: selection.start,
      end: selection.end,
      text: selection.text,
      note: noteText.trim(),
    })
    setSelection(null)
    setShowNoteInput(false)
    setNoteText('')
    window.getSelection()?.removeAllRanges()
  }

  function handleCancel() {
    setSelection(null)
    setShowNoteInput(false)
    setNoteText('')
    window.getSelection()?.removeAllRanges()
  }

  const segments = buildSegments(content, annotations)

  return (
    <div className="relative">
      {atMax && (
        <div className="mb-3 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-300">
          Maximum {maxAnnotations} flagged sections reached. Submit current revisions or remove one to flag more.
        </div>
      )}

      <div
        ref={contentRef}
        onMouseUp={handleMouseUp}
        className="select-text cursor-text whitespace-pre-wrap text-sm leading-relaxed text-foreground"
      >
        {segments.map((seg, i) =>
          seg.flagged ? (
            <mark
              key={i}
              className="group relative cursor-pointer rounded-sm bg-amber-400/30 px-0.5 text-foreground ring-1 ring-amber-400/50"
              title="Click × to remove flag"
            >
              {seg.text}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (seg.annotationId) onRemove(seg.annotationId)
                }}
                className="ml-0.5 inline-flex size-3.5 items-center justify-center rounded-full bg-amber-400/40 text-amber-200 opacity-0 transition-opacity hover:bg-amber-400/70 group-hover:opacity-100"
                aria-label="Remove flag"
              >
                <X className="size-2.5" />
              </button>
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
      </div>

      {/* Floating toolbar — appears above selection */}
      {selection && !showNoteInput && (
        <div
          className="absolute z-20 -translate-x-1/2 -translate-y-full"
          style={{ left: selection.x, top: selection.y - 8 }}
        >
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1.5 shadow-xl">
            <button
              type="button"
              onClick={handleFlagClick}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-amber-300 hover:bg-amber-400/10 hover:text-amber-200"
            >
              <Flag className="size-3" />
              Flag for revision
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      {/* Note input popover */}
      {selection && showNoteInput && (
        <div
          className="absolute z-20 -translate-x-1/2 -translate-y-full"
          style={{ left: selection.x, top: selection.y - 8 }}
        >
          <div className="w-72 rounded-lg border border-border bg-card p-3 shadow-xl">
            <p className="mb-2 truncate text-xs text-muted-foreground">
              <Flag className="mr-1 inline size-3 text-amber-400" />
              &ldquo;{selection.text}&rdquo;
            </p>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="What should change here? (optional)"
              rows={2}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmitNote()
              }}
              className="w-full resize-none rounded border border-input bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitNote}
                className="rounded bg-amber-500 px-2 py-1 text-xs font-medium text-black hover:bg-amber-400"
              >
                Flag section
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
