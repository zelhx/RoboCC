import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, PerspectiveCamera } from '@react-three/drei'
import Arena from './Arena'
import Robot from './Robot'
import IKTarget from './IKTarget'

export default function Scene() {
  const [orbitEnabled, setOrbitEnabled] = useState(true)

  return (
    <Canvas shadows>
      <PerspectiveCamera makeDefault position={[0, 6, 16]} fov={50} />

      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.1}
        shadow-camera-far={50}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />

      <Environment preset="night" />

      <Arena />
      <Robot />
      <IKTarget onDragChange={(isDragging) => setOrbitEnabled(!isDragging)} />

      <OrbitControls
        target={[0, 2, 0]}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={3}
        maxDistance={40}
        enablePan={false}
        enabled={orbitEnabled}
      />
    </Canvas>
  )
}
