'use client'

import { AnimatePresence, m } from 'framer-motion'
import { BrandWordmark } from '@/components/brand-wordmark'

interface InitialPreloaderProps {
  visible: boolean
}

export function InitialPreloader({ visible }: InitialPreloaderProps) {
  return (
    <AnimatePresence>
      {visible ? (
        <m.div
          key="initial-preloader"
          className="pointer-events-none fixed inset-0 z-[90] overflow-hidden bg-[linear-gradient(180deg,rgba(22,25,23,0.98),rgba(15,18,16,0.98))]"
          initial={{ opacity: 1, clipPath: 'inset(0% 0% 0% 0%)' }}
          animate={{ opacity: 1, clipPath: 'inset(0% 0% 0% 0%)' }}
          exit={{
            opacity: 0,
            clipPath: 'inset(0% 0% 100% 0%)',
            transition: { duration: 0.72, ease: [0.76, 0, 0.24, 1] },
          }}
        >
          <m.div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(145,255,88,0.14)_0%,rgba(255,255,255,0.04)_34%,transparent_68%)]"
            initial={{ opacity: 0.45, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1.04 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />

          <m.div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/90 to-transparent"
            initial={{ scaleX: 0.2, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          />

          <div className="relative flex min-h-screen items-center justify-center px-6">
            <m.div
              className="flex max-w-md flex-col items-center text-center"
              initial={{ opacity: 0, y: 20, filter: 'blur(14px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -12, filter: 'blur(10px)' }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            >
              <BrandWordmark href="/" />
              <p className="mt-8 text-[0.68rem] font-semibold uppercase tracking-[0.34em] text-foreground/48">
                Editorial system
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-foreground sm:text-4xl">
                Setting the stage.
              </h2>
              <p className="mt-3 text-sm leading-7 text-foreground/62">
                Preparing the workspace with a cleaner, calmer motion pass.
              </p>

              <div className="mt-8 h-px w-40 overflow-hidden rounded-full bg-border/60">
                <m.div
                  className="lime-gradient-bg h-full w-full origin-left"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </m.div>
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  )
}
