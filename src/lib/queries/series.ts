import { createClient } from '@/lib/supabase/server'
import type { ContentSeries, SeriesWithBriefs } from '@/lib/types'

function logQueryError(context: string, error: unknown) {
  console.error(`[series:${context}]`, error)
}

export async function getSeries(): Promise<ContentSeries[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('content_series')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    logQueryError('list', error)
    return []
  }

  return (data ?? []) as ContentSeries[]
}

export async function getSeriesById(id: string): Promise<SeriesWithBriefs | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('content_series')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    logQueryError('get', error)
    return null
  }

  const { data: briefs, error: briefsError } = await supabase
    .from('briefs')
    .select('id, series_id, series_part_number, angle, status')
    .eq('series_id', id)
    .order('series_part_number', { ascending: true })

  if (briefsError) {
    logQueryError('briefs', briefsError)
    return { ...(data as ContentSeries), briefs: [] }
  }

  // Fetch linked posts for each brief
  const briefIds = (briefs ?? []).map((b) => b.id)
  const postsByBriefId: Map<string, { id: string; status: string }> = new Map()

  if (briefIds.length > 0) {
    const { data: posts } = await supabase
      .from('posts')
      .select('id, brief_id, status')
      .in('brief_id', briefIds)

    for (const post of posts ?? []) {
      if (post.brief_id) {
        postsByBriefId.set(post.brief_id, { id: post.id, status: post.status })
      }
    }
  }

  return {
    ...(data as ContentSeries),
    briefs: (briefs ?? []).map((b) => ({
      id: b.id,
      series_id: b.series_id,
      series_part_number: b.series_part_number,
      angle: b.angle,
      status: b.status,
      post_id: postsByBriefId.get(b.id)?.id ?? null,
      post_status: postsByBriefId.get(b.id)?.status ?? null,
    })),
  }
}
