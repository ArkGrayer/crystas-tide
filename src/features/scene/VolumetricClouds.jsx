import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Clouds, Cloud } from '@react-three/drei'

export default function VolumetricClouds() {
  const groupRef = useRef()

  // Slow independent wind drift
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.position.x -= delta * 0.6
      if (groupRef.current.position.x < -1200) {
        groupRef.current.position.x = 1200
      }
    }
  })

  return (
    <group position={[0, 80, -350]}>
      <group ref={groupRef}>
        {/*
          No material prop → Drei uses its own default cloud material,
          which is NOT affected by scene lighting/shadows, so clouds
          stay bright even when backlit by the sun.
        */}
        <Clouds limit={400} range={1200}>
          {/* Wide cumulus banks spanning the full horizon */}
          <Cloud
            seed={10}
            bounds={[500, 40, 200]}
            volume={80}
            segments={60}
            color="#f0ece8"
            fade={200}
            opacity={0.55}
            growth={6}
            speed={0.08}
            position={[-200, 0, 0]}
          />
          <Cloud
            seed={22}
            bounds={[600, 50, 250]}
            volume={90}
            segments={65}
            color="#ffffff"
            fade={250}
            opacity={0.5}
            growth={6}
            speed={0.06}
            position={[250, 15, -80]}
          />
          <Cloud
            seed={33}
            bounds={[450, 35, 180]}
            volume={70}
            segments={50}
            color="#ede8e3"
            fade={180}
            opacity={0.5}
            growth={5}
            speed={0.1}
            position={[-600, -5, 40]}
          />
          <Cloud
            seed={44}
            bounds={[550, 45, 220]}
            volume={85}
            segments={55}
            color="#ffffff"
            fade={220}
            opacity={0.45}
            growth={5}
            speed={0.07}
            position={[700, 10, -50]}
          />
          {/* Smaller accents filling gaps */}
          <Cloud
            seed={55}
            bounds={[300, 25, 120]}
            volume={50}
            segments={35}
            color="#f5f0eb"
            fade={120}
            opacity={0.4}
            growth={4}
            speed={0.12}
            position={[-900, 8, -30]}
          />
          <Cloud
            seed={66}
            bounds={[350, 30, 150]}
            volume={55}
            segments={40}
            color="#ffffff"
            fade={140}
            opacity={0.4}
            growth={4}
            speed={0.09}
            position={[1000, -3, 20]}
          />
        </Clouds>
      </group>
    </group>
  )
}
