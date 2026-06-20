# Three.js + Framer Motion Integration Playbook

A technical reference and code template collection for integrating **Three.js** (via React Three Fiber) with **Framer Motion** in React and Next.js applications. Covers the core patterns for syncing WebGL 3D scenes with scroll-driven DOM animations — without fighting React's render cycle, killing performance, or breaking SSR.

This is not a runnable application. It is a **curated knowledge artifact** — architecture guides, performance rules, and copy-paste-ready code templates — designed to be read and adapted into your own projects.

---

## 📖 Features

- **Scroll-Synced 3D + DOM** — Bridge Three.js and Framer Motion via shared `MotionValue`s with zero re-renders.
- **SSR & Code-Splitting** — Next.js App Router strategies (`'use client'`, `next/dynamic`) to keep Three.js out of the initial bundle.
- **Performance Rules** — Six non-negotiable rules for smooth 60fps combined WebGL/DOM scenes.
- **Decision Tree** — Know at a glance whether you need R3F alone, Framer Motion alone, or both.
- **Drop-In Templates** — Ready-to-copy `.tsx` and `.ts` files for scroll heroes, page transitions, and vanilla Three.js cleanup.
- **Reference Deep-Dives** — Separate documents for Three.js/R3F patterns, Framer Motion patterns, and scroll-sync recipes.

---

## 🧰 Tech Stack

| Technology | Purpose |
|---|---|
| [Three.js](https://threejs.org/) | WebGL 3D rendering |
| [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) | React renderer for Three.js |
| [React Three Drei](https://github.com/pmndrs/drei) | R3F utility helpers |
| [Framer Motion](https://www.framer.com/motion/) | Declarative DOM & gesture animations |
| [Next.js](https://nextjs.org/) (App Router) | React framework with SSR |
| [TypeScript](https://www.typescriptlang.org/) | Type safety across all templates |
| [Tailwind CSS](https://tailwindcss.com/) | Utility styling (used in examples) |

---

## 📁 Folder Structure

```
motion-3d-skill/
├── SKILL.md                              # Main playbook — start here
├── references/
│   ├── three-fiber-patterns.md           # Canvas, GLTF, lighting, instancing, vanilla fallback
│   ├── framer-motion-patterns.md         # Variants, scroll reveals, gestures, page transitions
│   └── scroll-sync-recipes.md            # Parallax, cursor+scroll, step-based, reverse direction
└── templates/
    ├── scroll-synced-hero/
    │   ├── ScrollHero.tsx                # DOM side — scroll tracking, lazy-loads Scene
    │   └── Scene.tsx                     # Canvas side — reads MotionValue imperatively
    ├── page-transition-template.tsx       # Next.js App Router template.tsx wrapper
    └── vanilla-three-cleanup.ts          # Manual Three.js setup/dispose hook
```

---

## ✅ Prerequisites

- [Node.js](https://nodejs.org/) 18+ (for Next.js App Router support)
- A React or Next.js project (the templates target Next.js but adapt easily to Vite/CRA)
- Basic familiarity with React, Three.js, and Framer Motion

---

## 📦 Installation

Add the required dependencies to your existing project:

```bash
npx skills add https://github.com/saidabror552-dev/motion-3d-skill --skill motion-3d-skill
```

> **Version note:** React Three Fiber's major version must match your React version — R3F v8 targets React 18, v9 targets React 19. Check `package.json` before scaffolding.

---

## 🌐 Environment Variables

This project does not define or require any environment variables. The templates and patterns are self-contained and rely only on the npm dependencies listed above.

---

## 🚀 How to Use

This repository is **read-only reference material**. There is no dev server or build step to run.

### 1. Start with the playbook

Open [`SKILL.md`](./SKILL.md) for the full integration strategy, decision tree, and performance rules.

### 2. Choose your context

| You want to... | Read |
|---|---|
| Set up a Canvas, load a 3D model, add lighting | [`references/three-fiber-patterns.md`](./references/three-fiber-patterns.md) |
| Add scroll reveals, page transitions, gesture animations | [`references/framer-motion-patterns.md`](./references/framer-motion-patterns.md) |
| Bridge both libraries for a scroll-driven 3D hero | [`references/scroll-sync-recipes.md`](./references/scroll-sync-recipes.md) |

### 3. Copy a template

Each file under [`templates/`](./templates/) is designed to be copied directly into your project:

```bash
# Example: add the scroll-synced hero to your app
cp templates/scroll-synced-hero/ScrollHero.tsx your-project/components/
cp templates/scroll-synced-hero/Scene.tsx      your-project/components/
```

Then import and render `<ScrollHero />` in any page.

### 4. Adapt and extend

- Replace `<icosahedronGeometry>` with your own GLTF model via `useGLTF`.
- Adjust `dpr`, `camera`, and `offset` values for your layout.
- Add `useTransform` to animate DOM copy from the same `scrollYProgress`.

---

## 📋 Core Pattern (at a glance)

```tsx
// ScrollHero.tsx — tracks scroll, lazy-loads the 3D scene
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
// Scene.tsx — reads the MotionValue inside useFrame (zero re-renders)
'use client'
import { Canvas, useFrame } from '@react-three/fiber'
import type { MotionValue } from 'framer-motion'
import { useRef } from 'react'
import type { Mesh } from 'three'

function RotatingMesh({ progress }: { progress: MotionValue<number> }) {
  const meshRef = useRef<Mesh>(null)

  useFrame(() => {
    if (!meshRef.current) return
    const p = progress.get()
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

---

## ⚡ Performance Rules (non-negotiable)

1. **Never** put a `MotionValue` read or scroll position into `useState` — use `.get()` inside `useFrame`.
2. **Animate only** `transform` and `opacity` in Framer Motion; use `layout` for layout animations.
3. **Cap DPR** on `<Canvas>`: `dpr={[1, 1.5]}` — uncapped DPR on mobile can 4x shader cost.
4. **Respect `prefers-reduced-motion`** on both the DOM and WebGL sides.
5. **Use `<instancedMesh>`** for 200+ repeated objects instead of mapping individual `<mesh>` elements.
6. **Dispose manually** — anything created with `new THREE.X()` outside JSX needs explicit `.dispose()`.

---

## 🧪 Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| Blank Canvas / no 3D visible | Canvas has no height | Ensure Canvas container has explicit height (e.g., `h-screen`) |
| Component renders nothing | Missing `'use client'` directive | Add `'use client'` at the top of any file using `<Canvas>` or `motion.*` |
| Heavy initial bundle | Three.js loaded on the server | Wrap the Canvas component in `dynamic(() => import(...), { ssr: false })` |
| Scroll animation stutters | Scroll position piped through `useState` | Read `progress.get()` imperatively inside `useFrame` instead |
| R3F install error | Version mismatch with React | Match R3F major version to React major version (v8 → React 18, v9 → React 19) |
| TypeScript errors for Three.js | Missing type definitions | Run `npm install -D @types/three` |

---

## 🤝 Contributing

This is a reference knowledge repository. Contributions that improve accuracy, add new battle-tested patterns, or fix errors are welcome.

1. Fork the repository.
2. Create a feature branch: `git checkout -b feat/your-pattern`
3. Commit your changes with a clear message.
4. Push to your fork and open a pull request.

---

## 📄 License

This project is not currently licensed. No license, copyright, or usage terms have been specified.

---

## ✍️ Author

Created and maintained by [Saidabror](https://t.me/sadiypro).

---

> **Note:** This repository contains architectural guidance and code templates — not a runnable application. To see the patterns in action, copy the templates into a Next.js project with the dependencies listed above.
