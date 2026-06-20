---
name: motion-3d-skill
description: >
  Technical implementation patterns for integrating Three.js (via React Three Fiber)
  and Framer Motion in React/Next.js websites — covers project setup, SSR/code-splitting,
  performance budgets, and the core recipe for syncing WebGL 3D scenes with scroll-driven
  DOM motion. Use this skill whenever the user asks to build a 3D hero section, WebGL
  background, particle effect, scroll-triggered 3D animation, parallax scene, page
  transition, scroll reveal, micro-interaction, or any combination of Three.js and
  Framer Motion on a website. Also trigger on keywords: "three.js", "R3F",
  "react-three-fiber", "framer motion", the "motion" library, "WebGL hero", "3D scene",
  "scroll animation", "interactive landing page", "canvas animation", "smooth website
  animations", or "motion system". This skill is code/architecture focused — pair it
  with a visual design-system skill for color, typography, and layout decisions.
---

# Three.js + Framer Motion Integration

A technical playbook for combining WebGL (Three.js) and DOM animation (Framer Motion)
in the same React/Next.js project without fighting React's render cycle, killing
performance, or breaking SSR. This skill covers **how to wire things together** — not
visual style. Pull in a design-system skill separately for colors, typography, and
layout decisions.

## Why these two libraries need a playbook

Three.js and Framer Motion solve different problems and live in different render
worlds:

- **Three.js / React Three Fiber** owns a `<canvas>` and runs its own render loop
  (`useFrame`) outside React's normal reconciliation — driven by
  `requestAnimationFrame`, not state updates.
- **Framer Motion** animates DOM elements and exposes `MotionValue`s that update
  *without* triggering a React re-render.

The "perfect integration" the two unlock together is reading a Framer Motion
`MotionValue` (e.g. scroll progress) directly inside a Three.js `useFrame` loop —
zero re-renders, steady frame rate, DOM and WebGL moving in lockstep. Most broken
implementations happen because someone pipes scroll position through `useState`,
which re-renders the whole React tree on every scroll event or animation frame.
Never do that — see Performance Rules below.

## Decision tree

| User wants... | Use |
|---|---|
| Background particles, 3D hero, product/model viewer, standalone WebGL scene | **React Three Fiber** alone — `references/three-fiber-patterns.md` |
| Scroll reveals, hover/tap states, stagger lists, drag, page transitions | **Framer Motion** alone — `references/framer-motion-patterns.md` |
| A 3D scene that reacts to scroll/cursor, cinematic scroll-driven hero, WebGL background synced with copy reveals | **Both, bridged via a shared MotionValue** — `references/scroll-sync-recipes.md` |

Don't reach for Three.js for things CSS/Framer Motion already do well (card hover
lift, fade-ins, layout transitions) — it's a 600KB+ dependency and overkill for
flat 2D motion.

## Setup

```bash
npm install three @react-three/fiber @react-three/drei framer-motion
npm install -D @types/three
```

React Three Fiber's major version must match the installed React major version —
R3F v9 targets React 19, v8 targets React 18. Check `package.json` before
scaffolding anything.

## Next.js: SSR and bundle-splitting

Both libraries touch browser-only APIs, so any component rendering `<Canvas>` or
using `motion.*` needs `'use client'` at the top of the file. For Three.js
specifically, go one step further and lazy-load the whole scene with
`next/dynamic` — this keeps the heavy three.js/R3F/drei bundle out of the initial
page chunk entirely, instead of just deferring its execution:

```tsx
const Scene = dynamic(() => import('./Scene'), {
  ssr: false,
  loading: () => <div className="h-screen bg-black" />, // static fallback, no layout shift
})
```

Framer Motion is light enough that `'use client'` alone is sufficient; it doesn't
need a dynamic import.

## The core combined pattern: scroll-synced 3D

This is the recipe that makes the two libraries feel like one system. The DOM
component owns scroll tracking via `useScroll`; the Canvas component reads the
resulting `MotionValue` every frame via `useFrame` — no scroll state ever touches
React's state tree.

```tsx
// ScrollHero.tsx — DOM side, owns the scroll container
'use client'
import { useRef } from 'react'
import { useScroll } from 'framer-motion'
import dynamic from 'next/dynamic'

const Scene = dynamic(() => import('./Scene'), { ssr: false })

export default function ScrollHero() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  })

  return (
    <div ref={containerRef} className="relative h-[200vh]">
      <div className="sticky top-0 h-screen">
        <Scene progress={scrollYProgress} />
      </div>
    </div>
  )
}
```

```tsx
// Scene.tsx — Canvas side, reads the MotionValue imperatively
'use client'
import { Canvas, useFrame } from '@react-three/fiber'
import type { MotionValue } from 'framer-motion'
import { useRef } from 'react'
import type { Mesh } from 'three'

function RotatingMesh({ progress }: { progress: MotionValue<number> }) {
  const meshRef = useRef<Mesh>(null)

  useFrame(() => {
    if (!meshRef.current) return
    const p = progress.get() // plain read — no subscription, no re-render
    meshRef.current.rotation.y = p * Math.PI * 2
    meshRef.current.position.z = -p * 5
  })

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#7C3AED" />
    </mesh>
  )
}

export default function Scene({ progress }: { progress: MotionValue<number> }) {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 5], fov: 45 }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 3, 3]} />
      <RotatingMesh progress={progress} />
    </Canvas>
  )
}
```

The same `scrollYProgress` value can drive DOM elements at the same time via
`useTransform` — e.g. fading the headline out as the 3D object rotates in, so the
WebGL and DOM layers feel like a single choreographed system instead of two
animations that happen to overlap. See `references/scroll-sync-recipes.md` for the
parallax-layer and cursor-reactive variants, and `templates/scroll-synced-hero/`
for the full working pair of files, ready to adapt.

## Performance rules (non-negotiable)

1. **Never put a `MotionValue` read or scroll position into `useState`** inside
   anything that runs per-frame — read it with `.get()` inside `useFrame`, never
   subscribe-and-setState.
2. **Animate only `transform` and `opacity`** in Framer Motion — anything touching
   layout (`width`, `top`, `left`) should use the `layout` prop instead, which FM
   optimizes via FLIP rather than forcing a reflow every frame.
3. **Cap device pixel ratio**: `dpr={[1, 1.5]}` (or `[1, 2]` at most) on
   `<Canvas>` — uncapped `devicePixelRatio` on a high-end phone can 4x the
   fragment-shader cost for no visible gain.
4. **Respect `prefers-reduced-motion`** on both sides — Framer Motion's
   `useReducedMotion()` hook for DOM animation, and a manual media-query check
   before enabling continuous rotation/parallax in the Three.js scene.
5. **Instance, don't duplicate** — for particle fields or repeated geometry, use
   `<instancedMesh>` instead of mapping N separate `<mesh>` elements; at 200+
   objects this is the difference between a smooth scene and a slideshow.
6. **Dispose what you create manually** — R3F auto-disposes JSX-declared
   geometries/materials on unmount, but anything created with `new THREE.X()`
   outside the render tree needs an explicit `.dispose()` in a cleanup function.

Full checklist with mobile/SSR specifics lives in
`references/three-fiber-patterns.md` and `references/scroll-sync-recipes.md`.

## Reference files

- `references/three-fiber-patterns.md` — Canvas setup, model loading (GLTF),
  lighting, camera controls, instancing, and a vanilla-Three.js fallback for
  one-off scenes where R3F is overkill
- `references/framer-motion-patterns.md` — variants, `whileInView` reveals,
  `useScroll`/`useTransform`, gestures, stagger, and Next.js App Router page
  transitions (including their real limitations)
- `references/scroll-sync-recipes.md` — parallax layers, cursor + scroll combined,
  progress-synced 3D steps, and triggering DOM motion from WebGL state

## Templates

Drop-in starting points in `templates/`:

- `templates/scroll-synced-hero/` — the full `ScrollHero` + `Scene` pair shown
  above, ready to copy and adapt
- `templates/page-transition-template.tsx` — App Router page-transition wrapper
- `templates/vanilla-three-cleanup.ts` — manual setup/dispose pattern for
  one-off scenes that don't justify pulling in React Three Fiber