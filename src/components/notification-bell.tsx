'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { markNotificationRead, markAllNotificationsRead } from '@/app/actions/notifications'
import type { Notification } from '@/lib/types'

interface Props {
  initialNotifications: Notification[]
}

const TYPE_LABEL: Record<string, string> = {
  post_submitted: 'New draft submitted',
  post_approved: 'Post approved',
  post_rejected: 'Post rejected',
  post_published: 'Post published',
  feedback_received: 'Feedback received',
}

function formatTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function NotificationBell({ initialNotifications }: Props) {
  const [notifications, setNotifications] = useState(initialNotifications)
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const unread = notifications.filter((n) => !n.read).length

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleMarkRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    startTransition(() => markNotificationRead(id))
  }

  function handleMarkAll() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    startTransition(() => markAllNotificationsRead())
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-medium">Notifications</span>
            {unread > 0 && (
              <button
                onClick={handleMarkAll}
                disabled={isPending}
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`border-b border-border last:border-0 ${!n.read ? 'bg-muted/30' : ''}`}
                >
                  {n.post_id ? (
                    <Link
                      href={`/post/${n.post_id}`}
                      onClick={() => {
                        if (!n.read) handleMarkRead(n.id)
                        setOpen(false)
                      }}
                      className="block px-4 py-3 hover:bg-muted/50"
                    >
                      <NotificationItem notification={n} />
                    </Link>
                  ) : (
                    <div
                      className="px-4 py-3"
                      onClick={() => !n.read && handleMarkRead(n.id)}
                    >
                      <NotificationItem notification={n} />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function NotificationItem({ notification: n }: { notification: Notification }) {
  return (
    <div className="flex items-start gap-3">
      {!n.read && (
        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
      )}
      <div className={`flex-1 ${n.read ? 'pl-4' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-medium text-foreground">
            {TYPE_LABEL[n.type] ?? n.type}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{formatTime(n.created_at)}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{n.title}</p>
        {n.body && <p className="mt-0.5 text-xs text-muted-foreground/70">{n.body}</p>}
      </div>
    </div>
  )
}
