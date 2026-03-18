'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { InitialPreloader } from '@/components/initial-preloader'

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const shouldReduceMotion = useReducedMotion()
  const [showInitialPreloader, setShowInitialPreloader] = useState(false)

  useEffect(() => {
    if (shouldReduceMotion || typeof window === 'undefined') {
      return
    }

    const hasSeenPreloader = window.sessionStorage.getItem('gw-initial-preloader-seen')
    if (hasSeenPreloader) {
      return
    }

    window.sessionStorage.setItem('gw-initial-preloader-seen', 'true')
    const frameId = window.requestAnimationFrame(() => {
      setShowInitialPreloader(true)
    })

    const timeoutId = window.setTimeout(() => {
      setShowInitialPreloader(false)
    }, 1200)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(timeoutId)
    }
  }, [shouldReduceMotion])

  return (
    <>
      <InitialPreloader visible={showInitialPreloader} />
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={pathname}
          className="relative"
          initial={
            shouldReduceMotion
              ? { opacity: 1 }
              : { opacity: 0, y: 10, scale: 0.996, filter: 'blur(5px)' }
          }
          animate={
            shouldReduceMotion
              ? { opacity: 1 }
              : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }
          }
          exit={
            shouldReduceMotion
              ? { opacity: 1 }
              : { opacity: 0, y: -6, scale: 1.002, filter: 'blur(5px)' }
          }
          transition={{
            type: 'spring',
            stiffness: 240,
            damping: 30,
            mass: 0.92,
          }}
        >
          {!shouldReduceMotion ? (
            <m.div
              aria-hidden="true"
              className="pointer-events-none fixed inset-x-[10%] top-20 z-0 h-20 rounded-full bg-[radial-gradient(circle,rgba(145,255,88,0.12)_0%,rgba(255,255,255,0.04)_48%,transparent_76%)] blur-3xl"
              initial={{ opacity: 0, scale: 0.96, y: -6 }}
              animate={{ opacity: 0.85, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.02, y: -8 }}
              transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            />
          ) : null}

          <m.div
            className="relative z-10"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0.9, y: 4 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.24,
              ease: 'easeOut',
              delay: shouldReduceMotion ? 0 : 0.04,
            }}
          >
            {children}
          </m.div>
        </m.div>
      </AnimatePresence>
    </>
  )
}
