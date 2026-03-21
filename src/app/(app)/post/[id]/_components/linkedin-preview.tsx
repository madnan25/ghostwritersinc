const LINKEDIN_MAX_CHARS = 3000

interface LinkedInPreviewProps {
  content: string
  authorName?: string
}

export function LinkedInPreview({ content, authorName = 'You' }: LinkedInPreviewProps) {
  const charCount = content.length
  const isOverLimit = charCount > LINKEDIN_MAX_CHARS
  const remaining = LINKEDIN_MAX_CHARS - charCount

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
          {authorName[0]?.toUpperCase() ?? 'Y'}
        </div>
        <div>
          <div className="text-sm font-semibold">{authorName}</div>
          <div className="text-xs text-muted-foreground">Just now · 🌐</div>
        </div>
      </div>

      {/* Content */}
      <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
        {content || <span className="text-muted-foreground italic">No content yet…</span>}
      </div>

      {/* Character count */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">LinkedIn preview</span>
        <span
          className={`text-xs font-medium tabular-nums ${
            isOverLimit
              ? 'text-destructive'
              : remaining < 200
                ? 'text-amber-400'
                : 'text-muted-foreground'
          }`}
        >
          {isOverLimit ? `${Math.abs(remaining)} over limit` : `${charCount} / ${LINKEDIN_MAX_CHARS}`}
        </span>
      </div>
    </div>
  )
}
