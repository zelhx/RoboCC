import { create } from 'zustand'

/**
 * Global robot simulator state.
 *
 * position   – world-space XZ position of the robot (Y is always ground level)
 * rotation   – yaw in radians (rotation around Y axis)
 * velocity   – linear speed m/s
 * status     – connection state: 'disconnected' | 'connecting' | 'connected'
 * motorLeft  – left motor power  [-1, 1]
 * motorRight – right motor power [-1, 1]
 * sensors    – latest sensor readings from the backend
 * logs       – telemetry log entries (newest first)
 */
const useRobotStore = create((set) => ({
  position: { x: 0, z: 0 },
  rotation: 0,
  velocity: 0,
  status: 'disconnected',
  motorLeft: 0,
  motorRight: 0,
  sensors: {
    frontDistance: null,
    leftDistance: null,
    rightDistance: null,
    battery: 100,
  },
  joints: [0, 0, 0, 0, 0, 0],   // J1–J6 in degrees
  logs: [],

  setJoint: (index, degrees) =>
    set((s) => {
      const joints = [...s.joints]
      joints[index] = degrees
      return { joints }
    }),

  // Apply all six joint angles at once (radians → degrees)
  setJoints: (radians) =>
    set({ joints: radians.map((r) => (r * 180) / Math.PI) }),

  setPosition: (position) => set({ position }),
  setRotation: (rotation) => set({ rotation }),
  setVelocity: (velocity) => set({ velocity }),
  setStatus: (status) => set({ status }),
  setMotors: (motorLeft, motorRight) => set({ motorLeft, motorRight }),
  setSensors: (sensors) => set((s) => ({ sensors: { ...s.sensors, ...sensors } })),

  addLog: (message, level = 'info') =>
    set((s) => ({
      logs: [{ id: Date.now(), message, level, ts: new Date().toISOString() }, ...s.logs].slice(0, 100),
    })),

  applyTelemetry: (data) =>
    set((s) => ({
      position: data.position ?? s.position,
      rotation: data.rotation ?? s.rotation,
      velocity: data.velocity ?? s.velocity,
      motorLeft: data.motorLeft ?? s.motorLeft,
      motorRight: data.motorRight ?? s.motorRight,
      sensors: data.sensors ? { ...s.sensors, ...data.sensors } : s.sensors,
    })),
}))

export default useRobotStore
