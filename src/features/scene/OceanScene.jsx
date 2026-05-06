import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { oceanVertexShader, oceanFragmentShader } from './shaders/ocean'
import VolumetricClouds from './VolumetricClouds'

// ─── Helpers ────────────────────────────────────────────────────
function lerp(a, b, t) {
  return a + (b - a) * t
}

// Reusable Vector3 — avoids allocations inside useFrame
const _sunPos = new THREE.Vector3()

// Sun arc: rises left, peaks center, sets right — ALWAYS above horizon
function computeSunPosition(progress) {
  const elevation = 3 + 32 * Math.sin(progress * Math.PI)
  const azimuth = 210 + progress * 120
  const phi = THREE.MathUtils.degToRad(90 - elevation)
  const theta = THREE.MathUtils.degToRad(azimuth)
  const r = 400
  _sunPos.set(
    Math.sin(phi) * Math.cos(theta) * r,
    Math.cos(phi) * r,
    Math.sin(phi) * Math.sin(theta) * r
  )
  return _sunPos
}

function getDaylightFactor(progress) {
  return Math.sin(progress * Math.PI)
}

// ─── Ocean with Vertex Displacement ─────────────────────────────
function Ocean({ analysisRef, isPlaying }) {
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
    // Read directly from the ref — no intermediate sync, no re-renders
    const bass = analysisRef.current.bass
    const treble = analysisRef.current.treble
    const progress = analysisRef.current.progress

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
function SunsetSky({ analysisRef }) {
  const skyRef = useRef()
  const smoothP = useRef(0)

  useFrame(() => {
    if (!skyRef.current) return
    const progress = analysisRef.current.progress
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

// ─── Dynamic Lighting ───────────────────────────────────────────
function SceneLighting({ analysisRef }) {
  const ambientRef = useRef()
  const dirRef = useRef()
  const smoothP = useRef(0)
  const { gl } = useThree()

  useFrame(() => {
    const progress = analysisRef.current.progress
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

// ─── Main Scene ─────────────────────────────────────────────────
export default function OceanScene({ analysisRef, isPlaying = false }) {
  return (
    <Canvas
      className="!absolute inset-0 z-0"
      camera={{ position: [0, 22, 45], rotation: [-0.08, 0, 0], fov: 55, near: 1, far: 20000 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.45 }}
    >
      <SunsetSky analysisRef={analysisRef} />
      <Ocean analysisRef={analysisRef} isPlaying={isPlaying} />
      <SceneLighting analysisRef={analysisRef} />
      <VolumetricClouds />

      <EffectComposer>
        <Bloom luminanceThreshold={1.1} luminanceSmoothing={0.4} intensity={0.4} radius={0.5} mipmapBlur />
      </EffectComposer>
    </Canvas>
  )
}
