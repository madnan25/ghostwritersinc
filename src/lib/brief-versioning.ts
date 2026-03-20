import type { SupabaseClient } from '@supabase/supabase-js'

export async function getLatestBriefVersion(
  supabase: SupabaseClient,
  briefId: string | null | undefined,
): Promise<{ id: string; version: number } | null> {
  if (!briefId) return null

  const { data, error } = await supabase
    .from('brief_versions')
    .select('id, version')
    .eq('brief_id', briefId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message ?? `Failed to load latest brief version for ${briefId}`)
  }

  return data
}
