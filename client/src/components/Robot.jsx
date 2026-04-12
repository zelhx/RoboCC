import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import useRobotStore from '../store/useRobotStore'

// ── Shared material presets ──────────────────────────────────────────────────
const BODY  = { color: '#1a1c1e', metalness: 0.85, roughness: 0.15 }
const DARK  = { color: '#0d0f11', metalness: 0.92, roughness: 0.08 }
const JOINT = { color: '#23272e', metalness: 0.80, roughness: 0.20 }
const CYAN  = { color: '#22d3ee', emissive: '#22d3ee', emissiveIntensity: 0.45, metalness: 0.5, roughness: 0.3 }

// Thin accent ring sitting on the X or Z axis of the parent joint
function AccentRing({ r = 0.18, tube = 0.022, horizontal = false }) {
  return (
    <mesh rotation={horizontal ? [Math.PI / 2, 0, 0] : [0, 0, 0]}>
      <torusGeometry args={[r, tube, 10, 48]} />
      <meshStandardMaterial {...CYAN} />
    </mesh>
  )
}

// Cyan pivot disk shown on the side of a rotary joint
function PivotDisk({ x = 0, y = 0, z = 0, r = 0.11, h = 0.07 }) {
  return (
    <mesh position={[x, y, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[r, r, h, 24]} />
      <meshStandardMaterial {...CYAN} />
    </mesh>
  )
}

export default function Robot() {
  const rootRef      = useRef()
  const turntableRef = useRef()
  const shoulderRef  = useRef()
  const elbowRef     = useRef()
  const wristRef     = useRef()

  const position = useRobotStore((s) => s.position)
  const rotation = useRobotStore((s) => s.rotation)
  const joints   = useRobotStore((s) => s.joints)

  useFrame(() => {
    if (!rootRef.current) return

    // World-space placement from store
    rootRef.current.position.x = position.x
    rootRef.current.position.z = position.z
    rootRef.current.rotation.y = rotation

    const toRad = (deg) => (deg * Math.PI) / 180

    if (turntableRef.current) turntableRef.current.rotation.y = toRad(joints[0])
    if (shoulderRef.current)  shoulderRef.current.rotation.x  = toRad(joints[1])
    if (elbowRef.current)     elbowRef.current.rotation.x     = toRad(joints[2])
    if (wristRef.current) {
      wristRef.current.rotation.x = toRad(joints[3])
      wristRef.current.rotation.y = toRad(joints[4])
      wristRef.current.rotation.z = toRad(joints[5])
    }
  })

  return (
    <group ref={rootRef}>

      {/* ═══════════════════════════════════════════
          BASE PEDESTAL
      ═══════════════════════════════════════════ */}

      {/* Heavy foot plate – sits flush on the floor */}
      <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.78, 0.90, 0.08, 40]} />
        <meshStandardMaterial {...BODY} />
      </mesh>
      {/* Foot accent ring */}
      <mesh position={[0, 0.085, 0]}>
        <torusGeometry args={[0.80, 0.022, 8, 56]} />
        <meshStandardMaterial {...CYAN} />
      </mesh>

      {/* Tapered column */}
      <mesh position={[0, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.58, 0.68, 30]} />
        <meshStandardMaterial {...DARK} />
      </mesh>

      {/* Turntable bearing housing */}
      <mesh position={[0, 0.79, 0]} castShadow>
        <cylinderGeometry args={[0.46, 0.38, 0.12, 30]} />
        <meshStandardMaterial {...JOINT} />
      </mesh>
      <mesh position={[0, 0.855, 0]}>
        <torusGeometry args={[0.46, 0.024, 8, 56]} />
        <meshStandardMaterial {...CYAN} />
      </mesh>

      {/* ═══════════════════════════════════════════
          J1 – TURNTABLE  (rotates around Y)
      ═══════════════════════════════════════════ */}
      <group ref={turntableRef} position={[0, 0.86, 0]}>

        {/* Turntable disk */}
        <mesh castShadow>
          <cylinderGeometry args={[0.40, 0.44, 0.16, 30]} />
          <meshStandardMaterial {...BODY} />
        </mesh>

        {/* Shoulder yoke – two uprights + top bridge */}
        <mesh position={[-0.20, 0.40, 0]} castShadow>
          <boxGeometry args={[0.12, 0.64, 0.26]} />
          <meshStandardMaterial {...BODY} />
        </mesh>
        <mesh position={[ 0.20, 0.40, 0]} castShadow>
          <boxGeometry args={[0.12, 0.64, 0.26]} />
          <meshStandardMaterial {...BODY} />
        </mesh>
        <mesh position={[0, 0.72, 0]} castShadow>
          <boxGeometry args={[0.50, 0.12, 0.26]} />
          <meshStandardMaterial {...BODY} />
        </mesh>

        {/* J2 pivot disks shown outside the yoke posts */}
        <PivotDisk x={-0.29} y={0.72} r={0.13} h={0.07} />
        <PivotDisk x={ 0.29} y={0.72} r={0.13} h={0.07} />

        {/* ═══════════════════════════════════════════
            J2 – SHOULDER  (rotates around X)
        ═══════════════════════════════════════════ */}
        <group ref={shoulderRef} position={[0, 0.72, 0]}>

          {/* Upper arm body */}
          <mesh position={[0, 0.65, 0]} castShadow>
            <boxGeometry args={[0.24, 1.16, 0.22]} />
            <meshStandardMaterial {...BODY} />
          </mesh>
          {/* Front face panel (slightly lighter shade for depth) */}
          <mesh position={[0, 0.65, 0.112]}>
            <boxGeometry args={[0.22, 1.14, 0.004]} />
            <meshStandardMaterial color="#20242a" metalness={0.7} roughness={0.25} />
          </mesh>
          {/* Cyan accent stripe down the front */}
          <mesh position={[0, 0.65, 0.116]}>
            <boxGeometry args={[0.048, 1.00, 0.003]} />
            <meshStandardMaterial {...CYAN} />
          </mesh>
          {/* Lower cap of upper arm */}
          <mesh position={[0, 0.08, 0]} castShadow>
            <boxGeometry args={[0.26, 0.14, 0.24]} />
            <meshStandardMaterial {...JOINT} />
          </mesh>

          {/* Elbow housing */}
          <mesh position={[0, 1.30, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.18, 0.22, 22]} />
            <meshStandardMaterial {...JOINT} />
          </mesh>
          {/* Elbow accent ring */}
          <mesh position={[0, 1.30, 0]}>
            <AccentRing r={0.18} tube={0.022} horizontal />
          </mesh>
          {/* J3 pivot disks */}
          <PivotDisk x={-0.22} y={1.30} r={0.11} h={0.07} />
          <PivotDisk x={ 0.22} y={1.30} r={0.11} h={0.07} />

          {/* ═══════════════════════════════════════════
              J3 – ELBOW  (rotates around X)
          ═══════════════════════════════════════════ */}
          <group ref={elbowRef} position={[0, 1.30, 0]}>

            {/* Forearm body */}
            <mesh position={[0, 0.44, 0]} castShadow>
              <boxGeometry args={[0.20, 0.78, 0.18]} />
              <meshStandardMaterial {...BODY} />
            </mesh>
            {/* Forearm front accent stripe */}
            <mesh position={[0, 0.44, 0.092]}>
              <boxGeometry args={[0.042, 0.68, 0.003]} />
              <meshStandardMaterial {...CYAN} />
            </mesh>
            {/* Forearm end taper block */}
            <mesh position={[0, 0.86, 0]} castShadow>
              <boxGeometry args={[0.17, 0.10, 0.15]} />
              <meshStandardMaterial {...DARK} />
            </mesh>

            {/* Wrist housing cylinder */}
            <mesh position={[0, 0.96, 0]} castShadow>
              <cylinderGeometry args={[0.120, 0.135, 0.16, 22]} />
              <meshStandardMaterial {...JOINT} />
            </mesh>
            {/* Wrist accent ring */}
            <mesh position={[0, 0.96, 0]}>
              <AccentRing r={0.120} tube={0.018} horizontal />
            </mesh>

            {/* ═══════════════════════════════════════════
                J4/5/6 – WRIST  (roll + pitch + yaw)
            ═══════════════════════════════════════════ */}
            <group ref={wristRef} position={[0, 1.06, 0]}>

              {/* Wrist flange */}
              <mesh castShadow>
                <cylinderGeometry args={[0.092, 0.098, 0.11, 22]} />
                <meshStandardMaterial {...BODY} />
              </mesh>
              {/* Roll groove ring */}
              <mesh position={[0, 0.055, 0]}>
                <torusGeometry args={[0.092, 0.015, 8, 30]} />
                <meshStandardMaterial {...CYAN} />
              </mesh>

              {/* Tool-mount disk */}
              <mesh position={[0, 0.14, 0]} castShadow>
                <cylinderGeometry args={[0.088, 0.092, 0.06, 20]} />
                <meshStandardMaterial {...DARK} />
              </mesh>

              {/* ── END EFFECTOR (gripper) ─────────────── */}

              {/* Gripper palm body */}
              <mesh position={[0, 0.235, 0]} castShadow>
                <boxGeometry args={[0.28, 0.10, 0.095]} />
                <meshStandardMaterial {...BODY} />
              </mesh>
              {/* Gripper rail slot (cyan line across palm) */}
              <mesh position={[0, 0.235, 0]}>
                <boxGeometry args={[0.265, 0.022, 0.012]} />
                <meshStandardMaterial {...CYAN} />
              </mesh>

              {/* Left finger */}
              <mesh position={[-0.105, 0.358, 0]} castShadow>
                <boxGeometry args={[0.048, 0.22, 0.070]} />
                <meshStandardMaterial {...DARK} />
              </mesh>
              {/* Left fingertip accent */}
              <mesh position={[-0.105, 0.475, 0]} castShadow>
                <boxGeometry args={[0.050, 0.032, 0.073]} />
                <meshStandardMaterial {...CYAN} />
              </mesh>

              {/* Right finger */}
              <mesh position={[ 0.105, 0.358, 0]} castShadow>
                <boxGeometry args={[0.048, 0.22, 0.070]} />
                <meshStandardMaterial {...DARK} />
              </mesh>
              {/* Right fingertip accent */}
              <mesh position={[ 0.105, 0.475, 0]} castShadow>
                <boxGeometry args={[0.050, 0.032, 0.073]} />
                <meshStandardMaterial {...CYAN} />
              </mesh>

            </group>
            {/* end wrist */}
          </group>
          {/* end elbow */}
        </group>
        {/* end shoulder */}
      </group>
      {/* end turntable */}

      {/* Cyan status glow at base */}
      <pointLight intensity={0.6} distance={3.5} color="#22d3ee" position={[0, 0.6, 0]} />

    </group>
  )
}
