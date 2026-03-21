'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname])

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={pathname}
        className="relative"
        initial={
          shouldReduceMotion
            ? { opacity: 1 }
            : { opacity: 0, y: 8 }
        }
        animate={
          shouldReduceMotion
            ? { opacity: 1 }
            : { opacity: 1, y: 0 }
        }
        exit={
          shouldReduceMotion
            ? { opacity: 1 }
            : { opacity: 0, y: -4 }
        }
        transition={{
          duration: shouldReduceMotion ? 0 : 0.26,
          ease: 'easeOut',
        }}
      >
        {!shouldReduceMotion ? (
          <m.div
            aria-hidden="true"
            className="pointer-events-none fixed inset-x-[10%] top-20 z-0 h-20 rounded-full bg-[radial-gradient(circle,rgba(145,255,88,0.12)_0%,rgba(255,255,255,0.04)_48%,transparent_76%)] blur-3xl"
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 0.72, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.02, y: -8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          />
        ) : null}

        <m.div
          className="relative z-10"
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0.88, y: 10 }}
          animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.38,
            ease: 'easeOut',
            delay: shouldReduceMotion ? 0 : 0.06,
          }}
        >
          {children}
        </m.div>
      </m.div>
    </AnimatePresence>
  )
}
