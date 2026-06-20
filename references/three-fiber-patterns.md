# React Three Fiber Patterns

Deep-dive on the Three.js side of the stack. Read this when the task is a
standalone 3D scene (no scroll/motion sync needed) — for the combined patterns,
go to `scroll-sync-recipes.md` instead.

## Canvas basics

`<Canvas>` from `@react-three/fiber` sets up the scene, camera, renderer, and
render loop in one component. It needs an explicit height from its parent — a
`<Canvas>` inside a `flex`/`grid` container with no height set collapses to 0px
and silently renders nothing. Always give the parent `h-screen`, `h-[Npx]`, or
similar before debugging anything else.

```tsx
<Canvas
  dpr={[1, 1.5]}                       // cap pixel ratio, see Performance rules
  camera={{ position: [0, 0, 5], fov: 45 }}
  gl={{ antialias: true, alpha: true }} // alpha: true = transparent canvas background
>
  {/* scene contents */}
</Canvas>
```

For a transparent canvas that shows the page background through it, set
`gl={{ alpha: true }}` and don't add a `<color attach="background" />` to the
scene — adding one paints an opaque background regardless of the `alpha` flag.

## `useFrame`: the render loop

`useFrame((state, delta) => { ... })` runs once per rendered frame, outside
React's render cycle. Mutate object refs directly — never call `setState` in
here, since that would force a React re-render on top of the WebGL render,
typically halving frame rate or worse.

```tsx
useFrame((state, delta) => {
  if (!meshRef.current) return
  meshRef.current.rotation.y += delta * 0.5 // delta-based = frame-rate independent
})
```

Use `delta` (seconds since last frame) for any continuous motion so the
animation speed doesn't change with the user's refresh rate or when a tab
re-gains focus after being backgrounded.

## Loading 3D models (GLTF)

```tsx
import { useGLTF } from '@react-three/drei'
import { Suspense } from 'react'

function Model() {
  const { scene } = useGLTF('/models/product.glb')
  return <primitive object={scene} />
}

// In the Canvas:
<Suspense fallback={null}>
  <Model />
</Suspense>

// Outside the component, so the browser starts fetching before the route
// suspends on it:
useGLTF.preload('/models/product.glb')
```

Always wrap `useGLTF`/`useTexture` consumers in `<Suspense>` inside the Canvas —
without it, the load is synchronous-looking in code but the resource isn't
ready, and the scene throws.

## Lighting

Two honest options, pick by how much control is needed:

- **Manual, cheap**: `<ambientLight intensity={0.5} />` +
  `<directionalLight position={[3, 3, 3]} />` — fine for stylized/flat-shaded
  scenes (most marketing-site hero objects).
- **Realistic, one line**: drei's `<Environment preset="city" />` (or
  `"sunset"`, `"studio"`, etc.) — image-based lighting that makes metallic/glass
  materials look correct without hand-tuning multiple lights. Costs a texture
  download; lazy-load alongside the rest of the scene.

## Camera controls

`<OrbitControls />` from drei is the default for any scene a visitor can drag
around. For marketing/hero scenes, disable the controls that fight the page's
own scroll and feel accidental:

```tsx
<OrbitControls
  enableZoom={false}
  enablePan={false}
  minPolarAngle={Math.PI / 2.5}
  maxPolarAngle={Math.PI / 1.8}
/>
```

If the scene should *not* be user-draggable at all (purely decorative
background), don't mount `OrbitControls` — drive the camera/object rotation
from `useFrame` or a scroll `MotionValue` instead (see
`scroll-sync-recipes.md`).

## Instancing for repeated geometry

Mapping a React array into N `<mesh>` elements works but means N draw calls —
fine for a handful of objects, a real cost past a few dozen. For particle
fields or grids, use `<instancedMesh>` and write per-instance transforms into a
shared matrix:

```tsx
import { useRef, useMemo, useLayoutEffect } from 'react'
import { Object3D, InstancedMesh } from 'three'

const COUNT = 500
const dummy = new Object3D()

function Particles() {
  const meshRef = useRef<InstancedMesh>(null)
  const positions = useMemo(
    () =>
      Array.from({ length: COUNT }, () => [
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
      ]),
    []
  )

  useLayoutEffect(() => {
    positions.forEach(([x, y, z], i) => {
      dummy.position.set(x, y, z)
      dummy.updateMatrix()
      meshRef.current?.setMatrixAt(i, dummy.matrix)
    })
    if (meshRef.current) meshRef.current.instanceMatrix.needsUpdate = true
  }, [positions])

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]}>
      <sphereGeometry args={[0.03, 8, 8]} />
      <meshStandardMaterial color="#9F4EF0" />
    </instancedMesh>
  )
}
```

One draw call for all 500 spheres instead of 500.

## Vanilla Three.js fallback (when R3F is overkill)

For a single decorative scene with no React-driven props and no interactivity —
nothing the React tree needs to read or write — pulling in the whole R3F/drei
dependency chain is sometimes more setup than the effect deserves. Plain
Three.js inside a `useEffect` is a legitimate, lighter alternative; the only
thing that must not be skipped is manual cleanup, since nothing auto-disposes
GPU resources outside R3F's reconciler. See
`templates/vanilla-three-cleanup.ts` for the full pattern — the short version:

```tsx
useEffect(() => {
  // create scene, camera, renderer, geometry, material, mesh, animate loop
  return () => {
    cancelAnimationFrame(frameId)
    geometry.dispose()
    material.dispose()
    renderer.dispose()
    container.removeChild(renderer.domElement)
  }
}, [])
```

Skipping the `return` cleanup is the single most common Three.js memory leak in
React apps — every remount (route change, Fast Refresh, conditional render)
leaves the previous WebGL context and buffers allocated.