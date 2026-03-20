import { getBriefs } from '@/lib/queries/posts'
import type { BriefStatus } from '@/lib/types'
import { BriefCard } from './_components/brief-card'
import { BriefStatusTabs } from './_components/brief-status-tabs'

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_review', label: 'In Review' },
  { value: 'revision_requested', label: 'Revision' },
  { value: 'done', label: 'Done' },
] as const

interface BriefsPageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function BriefsPage({ searchParams }: BriefsPageProps) {
  const { status } = await searchParams
  const validStatuses: Array<BriefStatus | ''> = [
    '',
    'pending',
    'in_review',
    'revision_requested',
    'done',
  ]
  const activeStatus = validStatuses.includes((status ?? '') as BriefStatus | '')
    ? (status ?? '')
    : ''

  const briefs = await getBriefs(activeStatus || undefined)

  return (
    <div className="container px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Briefs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Strategist briefs and editorial plans for content creation
        </p>
      </div>

      <BriefStatusTabs filters={STATUS_FILTERS} activeStatus={activeStatus} />

      <div className="mt-6">
        {briefs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-2xl">
              📋
            </div>
            <h3 className="mt-4 text-base font-semibold">No briefs found</h3>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
              {activeStatus
                ? `No briefs with status "${STATUS_FILTERS.find((f) => f.value === activeStatus)?.label ?? activeStatus}".`
                : 'Briefs will appear here once the Strategist agent creates them.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {briefs.map((brief) => (
              <BriefCard key={brief.id} brief={brief} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
