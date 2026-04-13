import { useRef, useState, useEffect, useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import socket from '../socket'

/**
 * Scale factor: IK solver works in millimetres.
 * The robot's shoulder sits at ~400 mm in IK space and ~1.58 Three.js units in
 * the visual scene, giving ≈ 253 mm per Three.js unit.
 */
const SCALE = 253

/**
 * Convert a THREE.Vector3 (y-up) to the IK solver's coordinate array (z-up).
 *   IK  x = scene x
 *   IK  y = scene z
 *   IK  z = scene y   (vertical)
 */
function toIKTarget(v3) {
  return [v3.x * SCALE, v3.z * SCALE, v3.y * SCALE]
}

/**
 * Draggable cyan target sphere.
 *
 * Drag behaviour:
 *   • On pointer-down the sphere captures a view-aligned drag plane.
 *   • Global pointermove / pointerup listeners drive the position so the drag
 *     stays smooth even when the pointer leaves the canvas boundary.
 *   • IK solve requests are throttled to ~60 fps.
 *
 * Props:
 *   onDragChange(isDragging: boolean) — called so parent can toggle OrbitControls.
 */
export default function IKTarget({ onDragChange }) {
  const groupRef = useRef()
  const [hovered, setHovered] = useState(false)
  const [dragging, setDragging] = useState(false)

  // Authoritative position lives in a ref so imperative updates skip React
  const posRef     = useRef(new THREE.Vector3(3.5, 2.0, 0))
  const dragPlane  = useRef(new THREE.Plane())
  const hitPoint   = useRef(new THREE.Vector3())
  const dragOffset = useRef(new THREE.Vector3())
  const lastEmit   = useRef(0)

  const { camera, gl } = useThree()

  // Set group position once on mount; drags update it imperatively.
  useEffect(() => {
    groupRef.current?.position.copy(posRef.current)
  }, [])

  const sendIK = useCallback((v3) => {
    const now = performance.now()
    if (now - lastEmit.current < 16) return   // ≤ 60 fps
    lastEmit.current = now
    socket.emit('ik:solve', { target: toIKTarget(v3) })
  }, [])

  const onPointerDown = useCallback((e) => {
    e.stopPropagation()

    // Build a drag plane that faces the camera and passes through the click point
    const normal = new THREE.Vector3()
    camera.getWorldDirection(normal).negate()
    dragPlane.current.setFromNormalAndCoplanarPoint(normal, e.point)

    // Record offset so the sphere doesn't snap to the pointer centre
    dragOffset.current.subVectors(e.point, posRef.current)

    setDragging(true)
    onDragChange?.(true)
    gl.domElement.style.cursor = 'grabbing'
  }, [camera, gl, onDragChange])

  // Global move/up listeners while dragging
  useEffect(() => {
    if (!dragging) return

    const raycaster = new THREE.Raycaster()

    const onMove = (e) => {
      const rect = gl.domElement.getBoundingClientRect()
      const ndcX = ((e.clientX - rect.left) / rect.width)  * 2 - 1
      const ndcY = -((e.clientY - rect.top)  / rect.height) * 2 + 1

      raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera)

      if (raycaster.ray.intersectPlane(dragPlane.current, hitPoint.current)) {
        posRef.current.subVectors(hitPoint.current, dragOffset.current)
        posRef.current.y = Math.max(0.05, posRef.current.y)   // keep above ground

        groupRef.current?.position.copy(posRef.current)
        sendIK(posRef.current)
      }
    }

    const onUp = () => {
      setDragging(false)
      onDragChange?.(false)
      gl.domElement.style.cursor = ''
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup',   onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup',   onUp)
    }
  }, [dragging, camera, gl, sendIK, onDragChange])

  // Cursor feedback on hover
  const onPointerEnter = useCallback(() => {
    setHovered(true)
    gl.domElement.style.cursor = 'grab'
  }, [gl])

  const onPointerLeave = useCallback(() => {
    if (dragging) return
    setHovered(false)
    gl.domElement.style.cursor = ''
  }, [dragging, gl])

  const emissive = dragging ? 2.2 : hovered ? 1.6 : 0.9
  const lightIntensity = dragging ? 3.5 : hovered ? 2.5 : 1.2

  return (
    <group ref={groupRef}>
      {/* Core sphere */}
      <mesh
        onPointerDown={onPointerDown}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        <sphereGeometry args={[0.12, 32, 32]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={emissive}
          transparent
          opacity={0.9}
          roughness={0.05}
          metalness={0.15}
        />
      </mesh>

      {/* Equatorial ring — makes it obvious and easy to click */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.21, 0.013, 8, 64]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={dragging ? 1.8 : 0.6}
          transparent
          opacity={0.75}
        />
      </mesh>

      {/* Vertical ring (orthogonal) */}
      <mesh>
        <torusGeometry args={[0.21, 0.013, 8, 64]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={dragging ? 1.8 : 0.6}
          transparent
          opacity={0.75}
        />
      </mesh>

      {/* Glow point light */}
      <pointLight color="#22d3ee" intensity={lightIntensity} distance={4.5} />
    </group>
  )
}
