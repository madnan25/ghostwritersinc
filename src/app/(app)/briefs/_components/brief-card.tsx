import Link from 'next/link'
import { CalendarDays, FileText, Layers, Sparkles } from 'lucide-react'
import type { BriefWithContext } from '@/lib/queries/briefs'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'border-amber-300/24 text-amber-200 bg-amber-500/8',
  },
  in_review: {
    label: 'In Review',
    className: 'border-sky-300/24 text-sky-200 bg-sky-500/8',
  },
  revision_requested: {
    label: 'Revision',
    className: 'border-orange-300/24 text-orange-200 bg-orange-500/8',
  },
  done: {
    label: 'Done',
    className: 'border-emerald-300/20 text-emerald-200 bg-emerald-500/8',
  },
}

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  urgent: {
    label: 'Urgent',
    className: 'border-red-300/24 text-red-300 bg-red-500/8',
  },
  normal: {
    label: 'Normal',
    className: 'border-border/60 text-muted-foreground',
  },
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface BriefCardProps {
  brief: BriefWithContext
}

export function BriefCard({ brief }: BriefCardProps) {
  const statusCfg = STATUS_CONFIG[brief.status] ?? { label: brief.status, className: 'border-border/60 text-muted-foreground' }
  const priorityCfg = PRIORITY_CONFIG[brief.priority] ?? PRIORITY_CONFIG.normal
  const href = brief.linked_post_id ? `/post/${brief.linked_post_id}` : null

  const inner = (
    <div className="dashboard-frame p-5 transition-shadow hover:shadow-[0_8px_28px_-12px_rgba(0,0,0,0.36)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`editorial-chip ${statusCfg.className}`}>
              {statusCfg.label}
            </span>
            {brief.priority === 'urgent' && (
              <span className={`editorial-chip ${priorityCfg.className}`}>
                {priorityCfg.label}
              </span>
            )}
            {brief.pillar_name ? (
              <span
                className="editorial-chip"
                style={
                  brief.pillar_color
                    ? {
                        borderColor: `${brief.pillar_color}33`,
                        color: brief.pillar_color,
                        backgroundColor: `${brief.pillar_color}10`,
                      }
                    : undefined
                }
              >
                {brief.pillar_name}
              </span>
            ) : (
              <span className="editorial-chip inline-flex items-center gap-1 border-violet-300/24 text-violet-300 bg-violet-500/8">
                <Sparkles className="size-3" />
                Wildcard
              </span>
            )}
          </div>

          {/* Angle */}
          <p className="mt-2.5 text-sm font-medium leading-snug line-clamp-2 text-foreground">
            {brief.angle}
          </p>

          {/* Meta row */}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {brief.publish_at && (
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5 shrink-0" />
                {formatDate(brief.publish_at)}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <FileText className="size-3.5 shrink-0" />
              {brief.linked_post_count === 0
                ? 'No linked posts'
                : brief.linked_post_count === 1
                  ? '1 linked post'
                  : `${brief.linked_post_count} linked posts`}
            </span>
            <span className="flex items-center gap-1.5">
              <Layers className="size-3.5 shrink-0" />
              {brief.source === 'human_request' ? 'Human request' : 'AI generated'}
            </span>
          </div>
        </div>

        {/* Created date */}
        <div className="shrink-0 text-right">
          <p className="text-[0.7rem] text-muted-foreground/70">Created</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(brief.created_at)}</p>
        </div>
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    )
  }

  return inner
}
