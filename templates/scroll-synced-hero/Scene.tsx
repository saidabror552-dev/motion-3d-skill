// Scene.tsx — Canvas side, reads the MotionValue imperatively inside useFrame.
//
// Swap the geometry/material for whatever the project needs — the part that
// matters and shouldn't be changed lightly is the useFrame + progress.get()
// pattern, which is what keeps this at a steady frame rate with zero React
// re-renders during scroll.
'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import type { MotionValue } from 'framer-motion'
import { useRef } from 'react'
import type { Mesh } from 'three'

function RotatingMesh({ progress }: { progress: MotionValue<number> }) {
  const meshRef = useRef<Mesh>(null)

  useFrame(() => {
    if (!meshRef.current) return
    const p = progress.get() // 0 -> 1 across the scroll range, no re-render

    meshRef.current.rotation.y = p * Math.PI * 2
    meshRef.current.rotation.x = p * Math.PI * 0.5
    meshRef.current.position.z = -p * 5
  })

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#7C3AED" metalness={0.3} roughness={0.4} />
    </mesh>
  )
}

export default function Scene({ progress }: { progress: MotionValue<number> }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 5], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 3, 3]} intensity={1} />
      <RotatingMesh progress={progress} />
    </Canvas>
  )
}