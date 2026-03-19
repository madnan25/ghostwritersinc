import { Tag, FileText, Target, StickyNote } from 'lucide-react'
import type { Brief, ContentPillar } from '@/lib/types'

interface BriefContextProps {
  briefRef: string | null
  pillar: ContentPillar | null
  brief: Brief | null
}

export function BriefContext({ briefRef, pillar, brief }: BriefContextProps) {
  if (!briefRef && !pillar && !brief) return null

  return (
    <div className="dashboard-frame p-5 sm:p-6">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.24em] text-primary/72">Brief Context</h2>
      <div className="flex flex-col gap-3">
        {pillar && (
          <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/20 p-3">
            <span
              className="mt-0.5 inline-block size-3 shrink-0 rounded-full"
              style={{ backgroundColor: pillar.color }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{pillar.name}</span>
                <span className="text-xs text-muted-foreground">Content Pillar</span>
              </div>
              {pillar.description && (
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{pillar.description}</p>
              )}
              {pillar.audience_summary && (
                <p className="mt-1 text-xs text-muted-foreground/70 italic">{pillar.audience_summary}</p>
              )}
            </div>
          </div>
        )}

        {brief?.angle && (
          <div className="flex items-start gap-3">
            <Target className="mt-0.5 size-4 shrink-0 text-sky-400" />
            <div>
              <div className="text-[0.72rem] uppercase tracking-[0.18em] text-sky-400/80">Angle</div>
              <div className="mt-0.5 text-sm">{brief.angle}</div>
            </div>
          </div>
        )}

        {brief?.voice_notes && (
          <div className="flex items-start gap-3">
            <StickyNote className="mt-0.5 size-4 shrink-0 text-amber-400" />
            <div>
              <div className="text-[0.72rem] uppercase tracking-[0.18em] text-amber-400/80">Strategist Notes</div>
              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{brief.voice_notes}</p>
            </div>
          </div>
        )}

        {briefRef && (
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <div className="text-[0.72rem] uppercase tracking-[0.18em] text-primary/70">Brief Reference</div>
              <div className="mt-0.5 text-sm font-medium">{briefRef}</div>
            </div>
          </div>
        )}

        {pillar && pillar.example_hooks && pillar.example_hooks.length > 0 && (
          <div className="flex items-start gap-3">
            <Tag className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <div className="text-[0.72rem] uppercase tracking-[0.18em] text-primary/70">Example Hooks</div>
              <ul className="mt-1 flex flex-col gap-1">
                {pillar.example_hooks.slice(0, 3).map((hook, i) => (
                  <li key={i} className="text-xs text-muted-foreground italic">&ldquo;{hook}&rdquo;</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
