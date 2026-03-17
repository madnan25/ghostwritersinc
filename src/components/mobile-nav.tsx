'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { m, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Calendar,
  Lightbulb,
  Target,
  MoreHorizontal,
  Users,
  BookOpen,
  Settings,
  X,
} from 'lucide-react'

const PRIMARY_TABS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/insights', label: 'Insights', icon: Lightbulb },
  { href: '/strategy', label: 'Strategy', icon: Target },
]

const MORE_ITEMS = [
  { href: '/team', label: 'Team', icon: Users },
  { href: '/research', label: 'Research', icon: BookOpen },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function MobileNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <>
      {/* Bottom Tab Bar */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch justify-around h-16">
          {PRIMARY_TABS.map((tab) => {
            const isActive =
              pathname === tab.href || pathname.startsWith(tab.href + '/')
            const Icon = tab.icon
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="relative flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[48px]"
                aria-current={isActive ? 'page' : undefined}
              >
                <AnimatePresence>
                  {isActive && (
                    <m.div
                      key="bg"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute inset-1 rounded-xl bg-muted"
                    />
                  )}
                </AnimatePresence>
                <Icon
                  className={`relative z-10 size-5 transition-colors duration-150 ${
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                />
                <span
                  className={`relative z-10 text-[10px] font-medium leading-none transition-colors duration-150 ${
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            )
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className="relative flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[48px] text-muted-foreground"
            aria-label="More navigation options"
            aria-expanded={moreOpen}
          >
            <MoreHorizontal className="size-5" />
            <span className="text-[10px] font-medium leading-none">More</span>
          </button>
        </div>
      </nav>

      {/* More Bottom Sheet */}
      <AnimatePresence>
        {moreOpen && (
          <>
            {/* Backdrop */}
            <m.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 z-50 bg-black/50"
              onClick={() => setMoreOpen(false)}
              aria-hidden="true"
            />

            {/* Sheet */}
            <m.div
              key="sheet"
              role="dialog"
              aria-modal="true"
              aria-label="More navigation"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-background border-t border-border"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-9 h-1 rounded-full bg-muted-foreground/30" />
              </div>

              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-sm font-semibold">More</span>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95 transition-transform"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>

              <nav className="flex flex-col gap-1 px-3 pt-1">
                {MORE_ITEMS.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href + '/')
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex items-center gap-3 rounded-2xl px-4 min-h-[56px] transition-colors active:scale-[0.98] ${
                        isActive
                          ? 'bg-muted text-foreground font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <Icon className="size-5 shrink-0" />
                      <span className="text-sm">{item.label}</span>
                    </Link>
                  )
                })}
              </nav>
            </m.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
