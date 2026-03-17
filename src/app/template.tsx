'use client'

import { m } from 'framer-motion'

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </m.div>
  )
}
