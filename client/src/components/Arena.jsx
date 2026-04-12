import { Grid } from '@react-three/drei'

export default function Arena() {
  return (
    <>
      {/* Ground plane – large factory floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#0f1520" />
      </mesh>

      {/* Grid overlay */}
      <Grid
        position={[0, 0.001, 0]}
        args={[100, 100]}
        cellSize={1}
        cellThickness={0.4}
        cellColor="#1e293b"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#334155"
        fadeDistance={60}
        fadeStrength={1.2}
        infiniteGrid
      />
    </>
  )
}
