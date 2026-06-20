// app/template.tsx — Next.js App Router page-transition wrapper.
//
// Goes at the App Router level, not inside a regular component. template.tsx
// remounts on every navigation (unlike layout.tsx, which persists), which is
// what makes the keyed motion.div below re-trigger its enter animation per route.
//
// CAVEAT, read before relying on this: App Router's server-driven, streaming
// navigation means the outgoing page is often torn down before an `exit`
// animation could play, so wrapping this in <AnimatePresence> for a two-sided
// crossfade is unreliable across navigations in practice. What you get
// reliably is a clean ENTER animation on the incoming page — which covers
// most of what people mean by "page transitions." If a true overlapping
// crossfade is required, capture the outgoing page into a manual overlay
// instead of depending on AnimatePresence's unmount detection.
'use client'

import { motion } from 'framer-motion'
import { usePathname } from 'next/navigation'

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  )
}