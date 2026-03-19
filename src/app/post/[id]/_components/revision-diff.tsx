'use client'

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  text: string
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')

  // Simple LCS-based line diff
  const m = oldLines.length
  const n = newLines.length

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to build diff
  const result: DiffLine[] = []
  let i = m
  let j = n

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ type: 'unchanged', text: oldLines[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', text: newLines[j - 1] })
      j--
    } else {
      result.unshift({ type: 'removed', text: oldLines[i - 1] })
      i--
    }
  }

  return result
}

interface RevisionDiffProps {
  oldContent: string
  newContent: string
  oldLabel: string
  newLabel: string
}

export function RevisionDiff({ oldContent, newContent, oldLabel, newLabel }: RevisionDiffProps) {
  const diff = computeDiff(oldContent, newContent)

  const hasChanges = diff.some((l) => l.type !== 'unchanged')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-destructive/40 border border-destructive/50" />
          {oldLabel}
        </span>
        <span>→</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500/30 border border-emerald-500/40" />
          {newLabel}
        </span>
      </div>

      {!hasChanges ? (
        <p className="text-sm text-muted-foreground italic">No changes between these versions.</p>
      ) : (
        <div className="rounded-lg border border-border bg-muted/10 font-mono text-[0.78rem] leading-relaxed overflow-x-auto">
          {diff.map((line, i) => (
            <div
              key={i}
              className={`flex px-3 py-0.5 ${
                line.type === 'added'
                  ? 'bg-emerald-500/10 text-emerald-300'
                  : line.type === 'removed'
                    ? 'bg-destructive/10 text-destructive/80 line-through decoration-destructive/40'
                    : 'text-muted-foreground'
              }`}
            >
              <span className="mr-3 w-3 shrink-0 select-none opacity-60">
                {line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}
              </span>
              <span className="whitespace-pre-wrap break-words">{line.text || '\u00A0'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
