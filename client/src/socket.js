import { io } from 'socket.io-client'
import useRobotStore from './store/useRobotStore'

const socket = io('http://localhost:3001', { autoConnect: false })

socket.on('connect', () => {
  useRobotStore.getState().setStatus('connected')
  useRobotStore.getState().addLog('Connected to server', 'info')
})

socket.on('disconnect', () => {
  useRobotStore.getState().setStatus('disconnected')
  useRobotStore.getState().addLog('Disconnected from server', 'warn')
})

socket.on('connect_error', () => {
  useRobotStore.getState().setStatus('disconnected')
})

socket.on('telemetry', (data) => {
  useRobotStore.getState().applyTelemetry(data)
})

export function initSocket() {
  useRobotStore.getState().setStatus('connecting')
  socket.connect()
}

export default socket
