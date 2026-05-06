import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { oceanVertexShader, oceanFragmentShader } from './shaders/ocean'
import { skyVertexShader, skyFragmentShader } from './shaders/sky'

// ─── Helpers ────────────────────────────────────────────────────
function lerp(a, b, t) {
  return a + (b - a) * t
}

// Reusable Vector3 — avoids allocations inside useFrame
const _sunPos = new THREE.Vector3()

// Sun arc: rises left, peaks center, sets right — ALWAYS above horizon
function computeSunPosition(progress) {
  const elevation = -6 + 28 * Math.sin(progress * Math.PI)
  const azimuth = 240 + progress * 60
  const phi = THREE.MathUtils.degToRad(90 - elevation)
  const theta = THREE.MathUtils.degToRad(azimuth)
  const r = 5000
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
    uSunColor: { value: new THREE.Color('#fff5e0') },
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
    uniforms.uSunColor.value.copy(getSunColor(smoothProgress.current))

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

// ─── Color Keyframes ─────────────────────────────────────────────
const SUN_COLOR_KEYFRAMES = [
  { t: 0.0,  color: new THREE.Color('#1a0a2e') },
  { t: 0.12, color: new THREE.Color('#ff6030') },
  { t: 0.25, color: new THREE.Color('#ffb060') },
  { t: 0.5,  color: new THREE.Color('#fff5e0') },
  { t: 0.75, color: new THREE.Color('#ff8040') },
  { t: 0.88, color: new THREE.Color('#cc3020') },
  { t: 1.0,  color: new THREE.Color('#0a0520') },
]

const HEMI_SKY_KEYFRAMES = [
  { t: 0.0,  color: new THREE.Color('#1a0a2e') },
  { t: 0.15, color: new THREE.Color('#ff7030') },
  { t: 0.3,  color: new THREE.Color('#ffe0a0') },
  { t: 0.5,  color: new THREE.Color('#fff8f0') },
  { t: 0.7,  color: new THREE.Color('#ff9050') },
  { t: 0.85, color: new THREE.Color('#cc4020') },
  { t: 1.0,  color: new THREE.Color('#0a0520') },
]

const HEMI_GROUND_KEYFRAMES = [
  { t: 0.0,  color: new THREE.Color('#050210') },
  { t: 0.15, color: new THREE.Color('#301008') },
  { t: 0.5,  color: new THREE.Color('#183040') },
  { t: 1.0,  color: new THREE.Color('#020108') },
]

const SKY_TOP_KEYFRAMES = [
  { t: 0.0,  color: new THREE.Color('#050210') },
  { t: 0.15, color: new THREE.Color('#101530') },
  { t: 0.3,  color: new THREE.Color('#1a4070') },
  { t: 0.5,  color: new THREE.Color('#2060a0') },
  { t: 0.7,  color: new THREE.Color('#1a3060') },
  { t: 0.85, color: new THREE.Color('#0a0520') },
  { t: 1.0,  color: new THREE.Color('#050210') },
]

const _tmpColor = new THREE.Color()
function lerpColorKeyframes(keyframes, t) {
  const p = THREE.MathUtils.clamp(t, 0, 1)
  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i]
    const b = keyframes[i + 1]
    if (p >= a.t && p <= b.t) {
      const local = (p - a.t) / (b.t - a.t)
      _tmpColor.lerpColors(a.color, b.color, local)
      return _tmpColor
    }
  }
  return keyframes[keyframes.length - 1].color
}

function getSunColor(progress) {
  return lerpColorKeyframes(SUN_COLOR_KEYFRAMES, progress)
}

// ─── Reactive Sky ───────────────────────────────────────────────
function SunsetSky({ analysisRef }) {
  const materialRef = useRef()
  const smoothP = useRef(0)

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunGlow: { value: 0 },
    uSkyTop: { value: new THREE.Color() },
    uSkyHorizon: { value: new THREE.Color() },
    uSunColor: { value: new THREE.Color() }
  }), [])

  useFrame((state, delta) => {
    if (!materialRef.current) return
    const progress = analysisRef.current.progress
    smoothP.current = lerp(smoothP.current, progress, 0.03)
    const p = smoothP.current
    
    const u = materialRef.current.uniforms
    u.uTime.value += delta
    u.uProgress.value = p
    
    const sunPos = computeSunPosition(p)
    const sunDir = sunPos.clone().normalize()
    u.uSunDir.value.copy(sunDir)
    
    u.uSunGlow.value = THREE.MathUtils.smoothstep(sunDir.y, -0.08, 0.08)
    
    u.uSkyTop.value.copy(lerpColorKeyframes(SKY_TOP_KEYFRAMES, p))
    u.uSkyHorizon.value.copy(lerpColorKeyframes(HEMI_SKY_KEYFRAMES, p))
    u.uSunColor.value.copy(getSunColor(p))
  })

  return (
    <mesh position={[0, 0, -2000]} scale={[10000, 10000, 1]} renderOrder={-1}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={skyVertexShader}
        fragmentShader={skyFragmentShader}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
        side={THREE.FrontSide}
      />
    </mesh>
  )
}

// ─── Dynamic Lighting ───────────────────────────────────────────
function SceneLighting({ analysisRef }) {
  const hemiRef = useRef()
  const smoothP = useRef(0)
  const { gl } = useThree()

  useFrame(() => {
    const progress = analysisRef.current.progress
    smoothP.current = lerp(smoothP.current, progress, 0.03)
    const p = smoothP.current
    const dl = getDaylightFactor(p)

    if (hemiRef.current) {
      hemiRef.current.intensity = 0.4 + dl * 0.5
      hemiRef.current.color.copy(lerpColorKeyframes(HEMI_SKY_KEYFRAMES, p))
      hemiRef.current.groundColor.copy(lerpColorKeyframes(HEMI_GROUND_KEYFRAMES, p))
    }
    gl.toneMappingExposure = 0.28 + dl * 0.32
  })

  return (
    <>
      <ambientLight intensity={0.15} />
      <hemisphereLight ref={hemiRef} position={[0, 100, 0]} />
    </>
  )
}

// ─── Main Scene ─────────────────────────────────────────────────
export default function OceanScene({ analysisRef, isPlaying = false }) {
  return (
    <Canvas
      className="!absolute inset-0 z-0"
      camera={{ position: [0, 22, 45], rotation: [0, 0, 0], fov: 55, near: 1, far: 20000 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.45 }}
    >
      <SunsetSky analysisRef={analysisRef} />
      <Ocean analysisRef={analysisRef} isPlaying={isPlaying} />
      <SceneLighting analysisRef={analysisRef} />

      <EffectComposer>
        <Bloom luminanceThreshold={1.1} luminanceSmoothing={0.4} intensity={0.4} radius={0.5} mipmapBlur />
      </EffectComposer>
    </Canvas>
  )
}
