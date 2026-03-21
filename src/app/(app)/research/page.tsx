import { getResearchPoolStats, getResearchPoolItems } from '@/lib/queries/research'
import { createClient } from '@/lib/supabase/server'
import { ResearchPoolStats } from './_components/research-pool-stats'
import { ResearchPoolList } from './_components/research-pool-list'
import { UploadList } from './_components/upload-list'
import { WhatsAppInstructions } from './_components/whatsapp-instructions'

async function getPillars() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('content_pillars')
    .select('id, name, color')
    .order('sort_order', { ascending: true })
  return (data ?? []) as Array<{ id: string; name: string; color: string }>
}

export default async function ResearchPage() {
  // Auth handled by middleware
  const [stats, items, pillars] = await Promise.all([
    getResearchPoolStats(),
    getResearchPoolItems(),
    getPillars(),
  ])

  return (
    <div className="premium-page space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Research</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload research materials and browse the intelligence pool powering your content.
        </p>
      </div>

      {/* Pool stats + pillar distribution */}
      {stats && <ResearchPoolStats stats={stats} />}

      {/* Filterable pool list */}
      {items.length > 0 && <ResearchPoolList items={items} pillars={pillars} />}

      {/* Upload section */}
      <section className="dashboard-frame p-5 sm:p-6">
        <div className="mb-5">
          <p className="premium-kicker text-[0.64rem]">Uploads</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-foreground sm:text-3xl">
            Add research materials
          </h2>
          <p className="mt-2 text-sm leading-7 text-foreground/66">
            Upload WhatsApp chat exports and other research materials for content mining.
          </p>
        </div>
        <div className="max-w-2xl space-y-6">
          <WhatsAppInstructions />
          <UploadList />
        </div>
      </section>
    </div>
  )
}
