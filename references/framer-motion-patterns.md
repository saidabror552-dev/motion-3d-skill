# Framer Motion Patterns

Deep-dive on the DOM-animation side of the stack. Read this when the task is
pure Framer Motion (no WebGL involved) — for syncing with a Three.js scene, go
to `scroll-sync-recipes.md` instead.

## Variants: the reusable animation unit

Inline `animate={{ opacity: 1 }}` props work for one-offs, but anything reused
across a section — especially with staggered children — should use a
`variants` object. It keeps timing logic out of JSX and lets parent/child
coordinate automatically.

```tsx
const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

<motion.ul variants={container} initial="hidden" animate="show">
  {items.map((it) => (
    <motion.li key={it.id} variants={item}>{it.label}</motion.li>
  ))}
</motion.ul>
```

The child only needs `variants={item}` — no `initial`/`animate` props of its
own. It inherits the parent's `"hidden"`/`"show"` state automatically, and
`staggerChildren` handles the per-child delay.

## Scroll reveals: `whileInView`

For "fade/slide in as it enters the viewport" — the most common marketing-site
ask — `whileInView` is lighter than wiring up `useScroll` manually:

```tsx
<motion.div
  initial={{ opacity: 0, y: 24 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: '-100px' }}
  transition={{ duration: 0.5 }}
>
  {content}
</motion.div>
```

`once: true` stops it from re-triggering on scroll-back-up (almost always the
intended behavior for marketing content). The negative `margin` triggers the
reveal slightly before the element is fully on-screen, which reads as snappier
than waiting for the exact edge.

## Scroll-linked values: `useScroll` + `useTransform`

For continuous scroll-driven values (parallax offsets, progress bars, opacity
ramps) rather than a one-time trigger:

```tsx
const { scrollYProgress } = useScroll({
  target: sectionRef,
  offset: ['start end', 'end start'],
})

const y = useTransform(scrollYProgress, [0, 1], [100, -100]) // parallax
const opacity = useTransform(scrollYProgress, [0, 0.3], [0, 1]) // fade in early

<motion.div style={{ y, opacity }}>{content}</motion.div>
```

`useTransform` output is itself a `MotionValue` — passing it to `style` updates
the DOM directly without a React re-render, the same mechanism the
Three.js-sync pattern relies on.

## Gestures

```tsx
<motion.button
  whileHover={{ scale: 1.04 }}
  whileTap={{ scale: 0.97 }}
  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
>
  Buy now
</motion.button>
```

For draggable elements, always set `dragConstraints` — an unconstrained
`drag` prop lets elements get dragged off-screen with no way back:

```tsx
<motion.div drag dragConstraints={containerRef} dragElastic={0.15} />
```

## `AnimatePresence`: exit animations

Plain `motion` components animate on mount, but not on unmount — React removes
the DOM node before an exit animation could play. `AnimatePresence` delays the
actual removal until the `exit` animation finishes:

```tsx
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      {modalContent}
    </motion.div>
  )}
</AnimatePresence>
```

Every direct child needs a stable, unique `key` — without one, `AnimatePresence`
can't tell which element is entering vs. leaving when the list changes.

## Shared-element transitions: `layoutId`

For a card that morphs into a detail view (or any "this element became that
element" transition), give both the source and destination element the same
`layoutId`. Framer Motion handles the position/size interpolation automatically
via FLIP — no manual coordinate math:

```tsx
// Card (list view)
<motion.div layoutId={`card-${id}`} onClick={() => setSelected(id)} />

// Expanded view (detail), conditionally rendered
<motion.div layoutId={`card-${id}`} className="fixed inset-0" />
```

Wrap both in the same `<LayoutGroup>` if they're far apart in the tree.

## Next.js App Router page transitions — and their real limit

The common recipe wraps route content in a `motion.div` keyed by pathname,
placed in `app/template.tsx` (which remounts on every navigation, unlike
`layout.tsx`):

```tsx
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
```

**Be upfront about the limitation**: App Router's server-driven, streaming
navigation means the outgoing page is often torn down before `AnimatePresence`
gets a clean chance to play its `exit` animation — wrapping the above in
`AnimatePresence` is a common suggestion online, but in practice it's
unreliable across navigations and shouldn't be promised as guaranteed. The
`template.tsx` + keyed `motion.div` pattern above gives a reliable **enter**
crossfade, which covers most of what people actually want from "page
transitions." If a true overlapping crossfade (both pages visible at once) is
required, render the outgoing page into a captured overlay manually rather
than depending on `AnimatePresence` unmount detection.

## Respecting reduced motion

```tsx
const shouldReduceMotion = useReducedMotion()

<motion.div
  animate={{ x: shouldReduceMotion ? 0 : 100 }}
  transition={{ duration: shouldReduceMotion ? 0 : 0.6 }}
/>
```

Branch the variant values, not just the duration, for anything large or
parallax-like — reducing duration to near-zero on a 200px translate still
produces a flash that can bother vestibular-sensitive users; collapsing the
distance to 0 is the more complete fix.