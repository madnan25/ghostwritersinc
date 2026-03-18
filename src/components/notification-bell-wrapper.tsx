import { getNotifications } from '@/lib/queries/notifications'
import { NotificationBell } from './notification-bell'

export async function NotificationBellWrapper() {
  let notifications: Awaited<ReturnType<typeof getNotifications>> = []
  try {
    notifications = await getNotifications()
  } catch {
    // User not authenticated or query failed — render bell with empty state
  }

  return <NotificationBell initialNotifications={notifications} />
}

export function NotificationBellFallback() {
  return <NotificationBell initialNotifications={[]} />
}
