'use client'

import { useMemo, useState } from 'react'

type TokenType = 'added' | 'removed' | 'unchanged'

interface DiffToken {
  type: TokenType
  text: string
}

function tokenize(text: string): string[] {
  // Split on whitespace boundaries, keeping whitespace tokens
  return text.split(/(\s+)/).filter((t) => t.length > 0)
}

/**
 * Normalize typographic characters to their ASCII equivalents for comparison.
 * Curly/smart quotes and apostrophes look identical to straight ones in most
 * fonts but differ in Unicode code points, causing phantom diffs.
 */
function normalizeForComparison(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'") // smart single quotes → straight
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"') // smart double quotes → straight
    .replace(/\u2026/g, '...') // ellipsis → three dots
}

function computeWordDiff(oldText: string, newText: string): DiffToken[] {
  const a = tokenize(oldText)
  const b = tokenize(newText)
  const m = a.length
  const n = b.length

  // Normalize tokens for comparison (handles smart quotes vs straight quotes)
  const aNorm = a.map(normalizeForComparison)
  const bNorm = b.map(normalizeForComparison)

  // LCS DP table (compare normalized forms)
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = aNorm[i - 1] === bNorm[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  // Backtrack to build token list (use new-side text for unchanged tokens)
  const tokens: DiffToken[] = []
  let i = m
  let j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aNorm[i - 1] === bNorm[j - 1]) {
      tokens.unshift({ type: 'unchanged', text: b[j - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tokens.unshift({ type: 'added', text: b[j - 1] })
      j--
    } else {
      tokens.unshift({ type: 'removed', text: a[i - 1] })
      i--
    }
  }

  return tokens
}

type ViewMode = 'inline' | 'side-by-side'

interface RevisionDiffProps {
  oldContent: string
  newContent: string
  oldLabel: string
  newLabel: string
}

export function RevisionDiff({ oldContent, newContent, oldLabel, newLabel }: RevisionDiffProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('inline')

  const tokens = useMemo(() => computeWordDiff(oldContent, newContent), [oldContent, newContent])
  const hasChanges = tokens.some((t) => t.type !== 'unchanged')

  return (
    <div className="flex flex-col gap-3">
      {/* Header row: legend + view toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border border-destructive/50 bg-destructive/40" />
            {oldLabel}
          </span>
          <span>→</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border border-emerald-500/40 bg-emerald-500/30" />
            {newLabel}
          </span>
        </div>

        <div className="flex overflow-hidden rounded-lg border border-border/60">
          <button
            onClick={() => setViewMode('inline')}
            className={`px-3 py-1 text-xs transition-colors ${
              viewMode === 'inline'
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            }`}
          >
            Inline
          </button>
          <button
            onClick={() => setViewMode('side-by-side')}
            className={`border-l border-border/60 px-3 py-1 text-xs transition-colors ${
              viewMode === 'side-by-side'
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            }`}
          >
            Side by side
          </button>
        </div>
      </div>

      {!hasChanges ? (
        <p className="text-sm italic text-muted-foreground">No changes between these versions.</p>
      ) : viewMode === 'inline' ? (
        <InlineDiff tokens={tokens} />
      ) : (
        <SideBySideDiff tokens={tokens} oldLabel={oldLabel} newLabel={newLabel} />
      )}
    </div>
  )
}

function InlineDiff({ tokens }: { tokens: DiffToken[] }) {
  return (
    <div className="rounded-lg border border-border bg-muted/10 p-4 text-sm leading-relaxed">
      <p className="whitespace-pre-wrap break-words">
        {tokens.map((token, i) => {
          if (token.type === 'unchanged') {
            return (
              <span key={i} className="text-muted-foreground">
                {token.text}
              </span>
            )
          }
          if (token.type === 'added') {
            return (
              <span key={i} className="rounded-[2px] bg-emerald-500/20 text-emerald-300">
                {token.text}
              </span>
            )
          }
          // removed
          return (
            <span
              key={i}
              className="rounded-[2px] bg-destructive/20 text-destructive/80 line-through decoration-destructive/50"
            >
              {token.text}
            </span>
          )
        })}
      </p>
    </div>
  )
}

function SideBySideDiff({
  tokens,
  oldLabel,
  newLabel,
}: {
  tokens: DiffToken[]
  oldLabel: string
  newLabel: string
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Old panel — shows unchanged + removed; additions are absent */}
      <div className="rounded-lg border border-border bg-muted/10 p-4 text-sm leading-relaxed">
        <div className="mb-2 text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground/70">
          {oldLabel}
        </div>
        <p className="whitespace-pre-wrap break-words">
          {tokens.map((token, i) => {
            if (token.type === 'unchanged') {
              return (
                <span key={i} className="text-muted-foreground">
                  {token.text}
                </span>
              )
            }
            if (token.type === 'removed') {
              return (
                <span
                  key={i}
                  className="rounded-[2px] bg-destructive/20 text-destructive/80 line-through decoration-destructive/50"
                >
                  {token.text}
                </span>
              )
            }
            // added — not shown in old panel
            return null
          })}
        </p>
      </div>

      {/* New panel — shows unchanged + added; removals are absent */}
      <div className="rounded-lg border border-border bg-muted/10 p-4 text-sm leading-relaxed">
        <div className="mb-2 text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground/70">
          {newLabel}
        </div>
        <p className="whitespace-pre-wrap break-words">
          {tokens.map((token, i) => {
            if (token.type === 'unchanged') {
              return (
                <span key={i} className="text-muted-foreground">
                  {token.text}
                </span>
              )
            }
            if (token.type === 'added') {
              return (
                <span key={i} className="rounded-[2px] bg-emerald-500/20 text-emerald-300">
                  {token.text}
                </span>
              )
            }
            // removed — not shown in new panel
            return null
          })}
        </p>
      </div>
    </div>
  )
}
