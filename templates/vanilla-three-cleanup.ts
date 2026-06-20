// vanilla-three-cleanup.ts — manual Three.js setup/dispose pattern.
//
// Use this only when React Three Fiber is genuinely overkill: a single
// decorative scene with no props from React, no interactivity, nothing the
// component tree needs to read back. For anything that takes props, responds
// to scroll, or has more than one object, use React Three Fiber instead —
// see references/three-fiber-patterns.md.
//
// The part that matters most here is the cleanup function. Skipping it is
// the single most common Three.js memory leak in React apps: every remount
// (route change, Fast Refresh, conditional render) leaves the previous WebGL
// context, geometry, and material buffers allocated on the GPU.
'use client'

import { useEffect, type RefObject } from 'react'
import * as THREE from 'three'

export function useThreeScene(containerRef: RefObject<HTMLDivElement>) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    )
    camera.position.z = 5

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    container.appendChild(renderer.domElement)

    const geometry = new THREE.IcosahedronGeometry(1, 1)
    const material = new THREE.MeshStandardMaterial({ color: '#7C3AED' })
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    scene.add(new THREE.DirectionalLight(0xffffff, 0.8))

    let frameId: number
    const animate = () => {
      mesh.rotation.y += 0.004
      renderer.render(scene, camera)
      frameId = requestAnimationFrame(animate)
    }
    animate()

    const handleResize = () => {
      if (!container) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', handleResize)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [containerRef])
}

// Usage:
//
// function DecorativeBackground() {
//   const containerRef = useRef<HTMLDivElement>(null)
//   useThreeScene(containerRef)
//   return <div ref={containerRef} className="absolute inset-0" />
// }