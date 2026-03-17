'use client'

import { m } from 'framer-motion'

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0.4, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
    >
      {children}
    </m.div>
  )
}
