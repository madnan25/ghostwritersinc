import { createClient } from '@/lib/supabase/server'
import type { Notification } from '@/lib/types'

export async function getNotifications(): Promise<Notification[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return []
  return data ?? []
}
