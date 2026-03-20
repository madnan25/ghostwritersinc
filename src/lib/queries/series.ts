import { createClient } from '@/lib/supabase/server'
import type { ContentSeries, SeriesStatus, SeriesWithBriefs } from '@/lib/types'

export interface PostSeriesInfo {
  series_id: string
  series_title: string
  series_total_parts: number
  series_status: SeriesStatus
  part_number: number
}

/**
 * Given a list of brief IDs, returns a map of briefId → PostSeriesInfo
 * for any briefs that belong to a series.
 * Returns empty map if content_series table doesn't exist yet.
 */
export async function getSeriesInfoForBriefs(
  briefIds: string[],
): Promise<Map<string, PostSeriesInfo>> {
  if (briefIds.length === 0) return new Map()

  const supabase = await createClient()

  const { data: briefs, error: briefsError } = await supabase
    .from('briefs')
    .select('id, series_id, series_part_number')
    .in('id', briefIds)
    .not('series_id', 'is', null)

  if (briefsError || !briefs || briefs.length === 0) {
    if (briefsError) logQueryError('series-briefs', briefsError)
    return new Map()
  }

  const seriesIds = Array.from(new Set(briefs.map((b) => b.series_id as string)))

  const { data: seriesList, error: seriesError } = await supabase
    .from('content_series')
    .select('id, title, total_parts, status')
    .in('id', seriesIds)

  if (seriesError || !seriesList) {
    if (seriesError) logQueryError('series-list', seriesError)
    return new Map()
  }

  const seriesById = new Map(seriesList.map((s) => [s.id, s]))
  const result = new Map<string, PostSeriesInfo>()

  for (const brief of briefs) {
    const seriesId = brief.series_id as string
    const s = seriesById.get(seriesId)
    if (s) {
      result.set(brief.id, {
        series_id: seriesId,
        series_title: s.title,
        series_total_parts: s.total_parts,
        series_status: s.status as SeriesStatus,
        part_number: brief.series_part_number as number,
      })
    }
  }

  return result
}

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
