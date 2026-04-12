import useRobotStore from '../store/useRobotStore'
import styles from './StatusBar.module.css'

const STATUS_COLOR = {
  disconnected: 'var(--danger)',
  connecting: 'var(--warn)',
  connected: 'var(--ok)',
}

export default function StatusBar() {
  const status = useRobotStore((s) => s.status)
  const position = useRobotStore((s) => s.position)
  const rotation = useRobotStore((s) => s.rotation)
  const velocity = useRobotStore((s) => s.velocity)
  const sensors = useRobotStore((s) => s.sensors)

  const deg = ((rotation * 180) / Math.PI).toFixed(1)

  return (
    <div className={styles.bar}>
      {/* Left: connection status */}
      <div className={styles.section}>
        <span className={styles.dot} style={{ color: STATUS_COLOR[status] }}>●</span>
        <span className={styles.statusText}>{status}</span>
      </div>

      <div className={styles.sep} />

      {/* Center: pose */}
      <div className={styles.section}>
        <Stat label="X" value={position.x.toFixed(3)} unit="m" />
        <Stat label="Z" value={position.z.toFixed(3)} unit="m" />
        <Stat label="HDG" value={deg} unit="deg" />
        <Stat label="SPD" value={velocity.toFixed(2)} unit="m/s" />
      </div>

      <div className={styles.sep} />

      {/* Right: battery */}
      <div className={styles.section}>
        <Stat label="BATT" value={sensors.battery} unit="%" />
      </div>

      {/* Far right: build tag */}
      <div className={styles.spacer} />
      <span className={styles.build}>RoboCC v0.1</span>
    </div>
  )
}

function Stat({ label, value, unit }) {
  return (
    <span className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statUnit}>{unit}</span>
    </span>
  )
}
