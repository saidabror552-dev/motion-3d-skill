// ScrollHero.tsx — DOM side, owns the scroll container.
//
// Drop this + Scene.tsx into a project, then customize the mesh/material in
// Scene.tsx and the headline content here. See SKILL.md "Core combined
// pattern" for how this works.
'use client'

import { useRef } from 'react'
import { useScroll, useTransform, motion } from 'framer-motion'
import dynamic from 'next/dynamic'

const Scene = dynamic(() => import('./Scene'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-black" />,
})

export default function ScrollHero() {
  const containerRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  })

  // DOM layer reacts to the same progress value the Canvas reads —
  // headline fades out as the 3D object finishes its scroll-driven rotation.
  const headlineOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0])
  const headlineY = useTransform(scrollYProgress, [0, 0.25], [0, -40])

  return (
    <div ref={containerRef} className="relative h-[200vh]">
      <div className="sticky top-0 h-screen overflow-hidden">
        <Scene progress={scrollYProgress} />

        <motion.div
          style={{ opacity: headlineOpacity, y: headlineY }}
          className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none"
        >
          <h1 className="text-5xl font-bold text-white">Your headline here</h1>
          <p className="mt-4 text-lg text-white/70">Scroll to explore</p>
        </motion.div>
      </div>
    </div>
  )
}