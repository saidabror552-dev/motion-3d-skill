# Scroll-Sync Recipes: Bridging Three.js and Framer Motion

The patterns here are what make a site feel like the WebGL and the DOM are one
choreographed system instead of two animations that happen to be on the same
page. The shared idea across all of them: **compute a `MotionValue` once, on
the DOM side, then read it from both the DOM (`style={{ ... }}`) and the
Three.js scene (`useFrame`)**. Nothing here triggers a React re-render — that's
the whole point.

## Recipe 1 — Scroll progress drives a 3D object (the baseline)

Covered in full in the main `SKILL.md` and in `templates/scroll-synced-hero/`.
The shape: `useScroll` on a DOM container → `scrollYProgress` MotionValue →
passed as a prop into the Canvas tree → read with `.get()` inside `useFrame`.
Every other recipe below is a variation on this shape.

## Recipe 2 — Parallax layers (DOM and WebGL depth together)

Multiple elements moving at different speeds relative to scroll reads as
depth. Drive both the DOM layers and the WebGL layers from the *same*
`scrollYProgress`, just with different `useTransform` output ranges per
"depth":

```tsx
// DOM side — background/foreground text layers
const slowY = useTransform(scrollYProgress, [0, 1], [0, -60])  // far layer
const fastY = useTransform(scrollYProgress, [0, 1], [0, -240]) // near layer

<motion.h1 style={{ y: slowY }}>Headline</motion.h1>
<motion.p style={{ y: fastY }}>Subhead</motion.p>
```

```tsx
// Canvas side — pass progress down, vary the multiplier per mesh group
useFrame(() => {
  const p = progress.get()
  farGroup.current.position.y = p * -1.5   // moves less = reads as "far"
  nearGroup.current.position.y = p * -4    // moves more = reads as "near"
})
```

Because every layer (DOM and WebGL) reads from the same source value, they
never drift out of sync with each other even under variable frame rate.

## Recipe 3 — Cursor + scroll combined (tilt that responds to both)

For a hero object that tilts toward the cursor *and* rotates with scroll, keep
the cursor position in its own `MotionValue` (via `useMotionValue`, updated in
a `pointermove` handler — not `useState`) and read both values together inside
the same `useFrame`:

```tsx
// DOM side
const mouseX = useMotionValue(0)
const mouseY = useMotionValue(0)

const handlePointerMove = (e: React.PointerEvent) => {
  const { innerWidth, innerHeight } = window
  mouseX.set((e.clientX / innerWidth) * 2 - 1)   // normalize to -1..1
  mouseY.set((e.clientY / innerHeight) * 2 - 1)
}

<div onPointerMove={handlePointerMove}>
  <Scene progress={scrollYProgress} mouseX={mouseX} mouseY={mouseY} />
</div>
```

```tsx
// Canvas side
useFrame(() => {
  const p = progress.get()
  const mx = mouseX.get()
  const my = mouseY.get()

  meshRef.current.rotation.y = p * Math.PI * 2 + mx * 0.3 // scroll + cursor tilt
  meshRef.current.rotation.x = my * 0.2
})
```

`useMotionValue` is the DOM-event equivalent of `useScroll` — it's how cursor
position gets into the per-frame-read system without ever calling `setState`
on every `pointermove`, which would otherwise re-render the React tree dozens
of times a second.

## Recipe 4 — Progress-synced steps (onboarding / feature walkthroughs)

When scroll should snap conceptually into "steps" (step 1 → object A visible;
step 2 → object A fades, object B appears), map the continuous progress value
into discrete ranges rather than introducing `useState` for the current step:

```tsx
useFrame(() => {
  const p = progress.get()
  meshARef.current.material.opacity = p < 0.33 ? 1 : Math.max(0, 1 - (p - 0.33) * 3)
  meshBRef.current.material.opacity = p > 0.33 && p < 0.66 ? 1 : 0
  meshCRef.current.material.opacity = p > 0.66 ? Math.min(1, (p - 0.66) * 3) : 0
})
```

If a DOM step-indicator needs to highlight the "current step" as text/UI
(not just animate continuously), that's one of the rare legitimate cases for
turning a continuous value into discrete React state — but throttle it: only
call `setState` when the computed step index actually changes, not on every
frame.

```tsx
const [activeStep, setActiveStep] = useState(0)

useMotionValueEvent(scrollYProgress, 'change', (latest) => {
  const step = latest < 0.33 ? 0 : latest < 0.66 ? 1 : 2
  setActiveStep((prev) => (prev === step ? prev : step)) // only updates on change
})
```

`useMotionValueEvent` (from `framer-motion`) is the sanctioned escape hatch for
the rare cases where React state genuinely needs to know about a MotionValue
change — it still only fires on actual value changes, not every frame.

## Recipe 5 — WebGL state triggering DOM motion (the reverse direction)

Less common, but sometimes a discrete event inside the 3D scene (a model
finishes loading, an animation completes, a hover-pick on a 3D object) should
trigger a DOM-side reveal. Since these are discrete events, not continuous
per-frame values, plain React state is the right tool here — lift a callback
up from the Canvas to the parent:

```tsx
// Scene.tsx
function Model({ onLoaded }: { onLoaded: () => void }) {
  const { scene } = useGLTF('/models/product.glb')
  useEffect(() => { onLoaded() }, [onLoaded])
  return <primitive object={scene} />
}

// Parent
const [modelReady, setModelReady] = useState(false)

<Scene onModelLoaded={() => setModelReady(true)} />
<AnimatePresence>
  {modelReady && (
    <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      Headline reveals once the model is ready
    </motion.h1>
  )}
</AnimatePresence>
```

## Mobile and reduced-motion checklist for combined scenes

- Cap `dpr` more aggressively on combined scenes than on a standalone 3D
  viewer — `[1, 1.25]` is reasonable when the canvas is also competing with
  scroll-event listeners for main-thread time.
- If `prefers-reduced-motion` is set, the simplest correct behavior for a
  scroll-synced 3D hero is usually to render the object in its final/resting
  pose statically and skip the scroll-driven transform entirely, rather than
  trying to preserve a reduced-but-still-present motion — for vestibular
  triggers, "moves with scroll" is often the issue regardless of magnitude.
- Test on an actual mid-range Android device, not just desktop Chrome
  throttling — `useFrame` + `useScroll` together are cheap individually but
  the combination is where janky scenes actually show up in the field.