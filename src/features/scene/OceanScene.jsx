import { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import { EffectComposer, Bloom, GodRays } from '@react-three/postprocessing'
import { BlendFunction, KernelSize } from 'postprocessing'
import * as THREE from 'three'
import { oceanVertexShader, oceanFragmentShader } from './shaders/ocean'

// ─── Helpers ────────────────────────────────────────────────────
function lerp(a, b, t) {
  return a + (b - a) * t
}

// Sun arc: rises left, peaks center, sets right — ALWAYS above horizon
function computeSunPosition(progress) {
  const elevation = 3 + 32 * Math.sin(progress * Math.PI)
  // Azimuth 210→330: sweeps left-to-right in front of camera
  const azimuth = 210 + progress * 120
  const phi = THREE.MathUtils.degToRad(90 - elevation)
  const theta = THREE.MathUtils.degToRad(azimuth)
  const r = 400
  return new THREE.Vector3(
    Math.sin(phi) * Math.cos(theta) * r,
    Math.cos(phi) * r,
    Math.sin(phi) * Math.sin(theta) * r
  )
}

function getDaylightFactor(progress) {
  return Math.sin(progress * Math.PI)
}

// ─── Ocean with Vertex Displacement ─────────────────────────────
function Ocean({ audioDataRef }) {
  const smoothBass = useRef(0)
  const smoothTreble = useRef(0)
  const smoothProgress = useRef(0)

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(3000, 3000, 256, 256)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uBass: { value: 0 },
    uTreble: { value: 0 },
    uSunPosition: { value: new THREE.Vector3(0, 400, 0) },
    uDeepColor: { value: new THREE.Color(0x001020) },
    uShallowColor: { value: new THREE.Color(0x0090b0) },
    uSkyColor: { value: new THREE.Color(0x6699bb) },
  }), [])

  const material = useMemo(
    () => new THREE.ShaderMaterial({
      vertexShader: oceanVertexShader,
      fragmentShader: oceanFragmentShader,
      uniforms,
      transparent: true,
      side: THREE.DoubleSide,
    }),
    [uniforms]
  )

  useFrame((_, delta) => {
    const { bass, treble, isPlaying, progress } = audioDataRef.current
    uniforms.uTime.value += delta

    const tgtBass = isPlaying ? bass : 0
    const tgtTreble = isPlaying ? treble : 0
    smoothBass.current = lerp(smoothBass.current, tgtBass, tgtBass > smoothBass.current ? 0.18 : 0.05)
    smoothTreble.current = lerp(smoothTreble.current, tgtTreble, 0.12)
    if (!isPlaying && smoothBass.current < 0.001) smoothBass.current = 0
    if (!isPlaying && smoothTreble.current < 0.001) smoothTreble.current = 0

    uniforms.uBass.value = smoothBass.current
    uniforms.uTreble.value = smoothTreble.current

    smoothProgress.current = lerp(smoothProgress.current, progress, 0.03)
    uniforms.uSunPosition.value.copy(computeSunPosition(smoothProgress.current))

    // Sky color & water color shift with daylight
    const dl = getDaylightFactor(smoothProgress.current)
    const p = smoothProgress.current
    const golden = (p < 0.15 || p > 0.85) ? 1 : 0

    uniforms.uSkyColor.value.setRGB(
      lerp(0.15, 0.45, dl) + golden * 0.15,
      lerp(0.12, 0.55, dl),
      lerp(0.2, 0.7, dl)
    )
    uniforms.uDeepColor.value.setRGB(
      lerp(0.003, 0.01, dl),
      lerp(0.015, 0.06, dl),
      lerp(0.04, 0.12, dl)
    )
  })

  return <mesh geometry={geometry} material={material} />
}

// ─── Reactive Sky ───────────────────────────────────────────────
function SunsetSky({ audioDataRef }) {
  const skyRef = useRef()
  const smoothP = useRef(0)

  useFrame(() => {
    if (!skyRef.current) return
    const { progress } = audioDataRef.current
    smoothP.current = lerp(smoothP.current, progress, 0.03)
    const p = smoothP.current
    const dl = getDaylightFactor(p)
    const golden = (p < 0.15 || p > 0.85)
    const u = skyRef.current.material.uniforms

    u.sunPosition.value.copy(computeSunPosition(p))
    u.turbidity.value = golden ? 12 : lerp(3, 8, 1 - dl)
    u.rayleigh.value = golden ? 3.5 : lerp(1, 2.5, dl)
    u.mieCoefficient.value = golden ? 0.012 : 0.005
    u.mieDirectionalG.value = golden ? 0.95 : 0.8
  })

  return (
    <Sky ref={skyRef} distance={450000} sunPosition={[0, 1, 0]}
      turbidity={10} rayleigh={2} mieCoefficient={0.005} mieDirectionalG={0.8} />
  )
}

// ─── Sun Sphere (shared via callback ref for GodRays) ───────────
function SunMesh({ audioDataRef, onReady }) {
  const meshRef = useRef()
  const smoothP = useRef(0)

  useEffect(() => {
    if (meshRef.current) onReady(meshRef.current)
  }, [onReady])

  useFrame(() => {
    if (!meshRef.current) return
    const { progress } = audioDataRef.current
    smoothP.current = lerp(smoothP.current, progress, 0.03)
    meshRef.current.position.copy(computeSunPosition(smoothP.current))

    const dl = getDaylightFactor(smoothP.current)
    const golden = (smoothP.current < 0.15 || smoothP.current > 0.85)
    const r = golden ? 1.4 : 0.95 + dl * 0.35
    const g = golden ? 0.75 : 0.85 + dl * 0.25
    const b = golden ? 0.3 : 0.7 + dl * 0.3
    meshRef.current.material.color.setRGB(r, g, b)
  })

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[10, 32, 32]} />
      <meshBasicMaterial toneMapped={false} color={[1.2, 0.9, 0.5]} />
    </mesh>
  )
}

// ─── Dynamic Lighting ───────────────────────────────────────────
function SceneLighting({ audioDataRef }) {
  const ambientRef = useRef()
  const dirRef = useRef()
  const smoothP = useRef(0)
  const { gl } = useThree()

  useFrame(() => {
    const { progress } = audioDataRef.current
    smoothP.current = lerp(smoothP.current, progress, 0.03)
    const dl = getDaylightFactor(smoothP.current)

    if (ambientRef.current) ambientRef.current.intensity = 0.15 + dl * 0.45
    if (dirRef.current) {
      dirRef.current.position.copy(computeSunPosition(smoothP.current))
      dirRef.current.intensity = 0.3 + dl * 0.8
    }
    gl.toneMappingExposure = 0.35 + dl * 0.35
  })

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.3} />
      <directionalLight ref={dirRef} position={[0, 100, 0]} intensity={0.5} color="#ffe0b2" />
    </>
  )
}

// ─── Cloud Layer ────────────────────────────────────────────────
function CloudLayer() {
  const clouds = useMemo(() => [
    { pos: [-120, 70, -400], scale: [80, 12, 30] },
    { pos: [60, 85, -450], scale: [100, 14, 35] },
    { pos: [-30, 60, -500], scale: [70, 10, 25] },
    { pos: [180, 75, -380], scale: [90, 13, 30] },
    { pos: [-200, 65, -420], scale: [75, 11, 28] },
    { pos: [250, 80, -470], scale: [85, 12, 32] },
    { pos: [-60, 90, -520], scale: [110, 15, 40] },
  ], [])

  return (
    <group>
      {clouds.map((c, i) => (
        <mesh key={i} position={c.pos} scale={c.scale}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshBasicMaterial color="#e8e0d8" transparent opacity={0.25} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

// ─── Main Scene ─────────────────────────────────────────────────
export default function OceanScene({ progress = 0, bass = 0, treble = 0, isPlaying = false }) {
  const audioDataRef = useRef({ progress, bass, treble, isPlaying })
  const [sunMesh, setSunMesh] = useState(null)

  useEffect(() => {
    audioDataRef.current = { progress, bass, treble, isPlaying }
  }, [progress, bass, treble, isPlaying])

  return (
    <Canvas
      className="!absolute inset-0 z-0"
      camera={{ position: [0, 22, 45], rotation: [-0.08, 0, 0], fov: 55, near: 1, far: 20000 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.45 }}
    >
      <SunsetSky audioDataRef={audioDataRef} />
      <Ocean audioDataRef={audioDataRef} />
      <SunMesh audioDataRef={audioDataRef} onReady={setSunMesh} />
      <SceneLighting audioDataRef={audioDataRef} />
      <CloudLayer />

      <EffectComposer>
        {sunMesh && (
          <GodRays
            sun={sunMesh}
            blendFunction={BlendFunction.SCREEN}
            samples={40}
            density={0.97}
            decay={0.94}
            weight={0.4}
            exposure={0.4}
            clampMax={1}
            kernelSize={KernelSize.SMALL}
            blur
          />
        )}
        <Bloom luminanceThreshold={1.0} luminanceSmoothing={0.3} intensity={0.8} radius={0.6} mipmapBlur />
      </EffectComposer>
    </Canvas>
  )
}
