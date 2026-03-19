'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Bot, User, Clock } from 'lucide-react'
import type { PostRevision } from '@/lib/types'

interface Props {
  revisions: PostRevision[]
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

function RevisionRow({ revision }: { revision: PostRevision }) {
  const [expanded, setExpanded] = useState(false)
  const revisedBy = revision.revised_by_agent ?? revision.revised_by_user ?? 'Unknown'
  const isAgent = !!revision.revised_by_agent

  return (
    <div className="rounded-lg border border-border bg-card/60">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-background text-[0.65rem] font-semibold text-foreground/72">
          v{revision.version}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isAgent ? (
              <Bot className="size-3 shrink-0 text-primary/70" />
            ) : (
              <User className="size-3 shrink-0 text-muted-foreground" />
            )}
            <span className="text-xs font-medium">{revisedBy}</span>
            {isAgent && (
              <span className="rounded-full border border-primary/25 bg-primary/10 px-1.5 py-px text-[0.6rem] font-medium uppercase tracking-[0.1em] text-primary/80">
                Agent
              </span>
            )}
          </div>
          {revision.revision_reason && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground italic">
              {revision.revision_reason}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {formatDate(revision.created_at)}
          </span>
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/60 p-3">
          <p className="mb-1.5 text-[0.68rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Content at this version
          </p>
          <pre className="whitespace-pre-wrap rounded-md border border-border/50 bg-background/60 p-3 text-xs leading-relaxed text-foreground/80">
            {revision.content}
          </pre>
        </div>
      )}
    </div>
  )
}

export function RevisionHistory({ revisions }: Props) {
  const [open, setOpen] = useState(false)

  if (revisions.length === 0) {
    return null
  }

  return (
    <div className="dashboard-frame p-6 sm:p-7">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4"
      >
        <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.24em] text-primary/72">
          <Clock className="size-4" />
          Revision History
          <span className="rounded-full bg-muted px-2 py-0.5 text-[0.72rem] tracking-normal text-foreground">
            {revisions.length}
          </span>
        </h2>
        {open ? (
          <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-2">
          {revisions.map((revision) => (
            <RevisionRow key={revision.id} revision={revision} />
          ))}
        </div>
      )}
    </div>
  )
}
