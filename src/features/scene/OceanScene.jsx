import { useRef, useMemo } from 'react'
import { Canvas, extend, useFrame, useLoader } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import * as THREE from 'three'
import { Water } from 'three-stdlib'

extend({ Water })

// ─── Ocean Plane ────────────────────────────────────────────────
function Ocean() {
  const ref = useRef()

  const waterNormals = useLoader(
    THREE.TextureLoader,
    '/waternormals.jpg'
  )
  waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping

  const geom = useMemo(() => new THREE.PlaneGeometry(30000, 30000), [])

  const config = useMemo(
    () => ({
      textureWidth: 512,
      textureHeight: 512,
      waterNormals,
      sunDirection: new THREE.Vector3(),
      sunColor: 0xfff5e0,
      waterColor: 0x001e2b,
      distortionScale: 4,
      fog: false,
    }),
    [waterNormals]
  )

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.material.uniforms.time.value += delta * 0.4
    }
  })

  return (
    <water
      ref={ref}
      args={[geom, config]}
      rotation-x={-Math.PI / 2}
      position={[0, 0, 0]}
    />
  )
}

// ─── Sunset Sky ─────────────────────────────────────────────────
function SunsetSky({ sunPosition }) {
  return (
    <Sky
      distance={450000}
      sunPosition={sunPosition}
      turbidity={10}
      rayleigh={2}
      mieCoefficient={0.005}
      mieDirectionalG={0.8}
      inclination={0.49}
      azimuth={0.25}
    />
  )
}

// ─── Main Scene ─────────────────────────────────────────────────
export default function OceanScene({ sunElevation = 2, sunAzimuth = 180 }) {
  const sunPosition = useMemo(() => {
    const phi = THREE.MathUtils.degToRad(90 - sunElevation)
    const theta = THREE.MathUtils.degToRad(sunAzimuth)
    return [
      Math.sin(phi) * Math.cos(theta) * 400,
      Math.cos(phi) * 400,
      Math.sin(phi) * Math.sin(theta) * 400,
    ]
  }, [sunElevation, sunAzimuth])

  return (
    <Canvas
      className="!absolute inset-0 z-0"
      camera={{
        position: [0, 5, 20],
        fov: 55,
        near: 1,
        far: 20000,
      }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.5,
      }}
    >
      <SunsetSky sunPosition={sunPosition} />
      <Ocean />

      <ambientLight intensity={0.3} />
      <directionalLight
        position={sunPosition}
        intensity={1.5}
        color="#ffe0b2"
      />
    </Canvas>
  )
}
