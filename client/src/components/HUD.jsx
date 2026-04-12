import useRobotStore from '../store/useRobotStore'
import styles from './HUD.module.css'

// J1–J6 axis definitions: label, min/max in degrees
const JOINT_DEFS = [
  { label: 'J1', axis: 'Base',     min: -170, max:  170 },
  { label: 'J2', axis: 'Shoulder', min:  -65, max:   90 },
  { label: 'J3', axis: 'Elbow',    min: -180, max:   70 },
  { label: 'J4', axis: 'Wrist X',  min: -185, max:  185 },
  { label: 'J5', axis: 'Wrist Y',  min: -120, max:  120 },
  { label: 'J6', axis: 'Wrist Z',  min: -350, max:  350 },
]

const STATUS_COLOR = {
  disconnected: 'var(--danger)',
  connecting: 'var(--warn)',
  connected: 'var(--ok)',
}

export default function HUD() {
  const status = useRobotStore((s) => s.status)
  const position = useRobotStore((s) => s.position)
  const rotation = useRobotStore((s) => s.rotation)
  const velocity = useRobotStore((s) => s.velocity)
  const motorLeft = useRobotStore((s) => s.motorLeft)
  const motorRight = useRobotStore((s) => s.motorRight)
  const sensors = useRobotStore((s) => s.sensors)
  const logs     = useRobotStore((s) => s.logs)
  const joints   = useRobotStore((s) => s.joints)
  const setJoint = useRobotStore((s) => s.setJoint)

  const deg = ((rotation * 180) / Math.PI).toFixed(1)

  return (
    <div className={styles.sidebar}>
      {/* Sidebar header */}
      <div className={styles.header}>
        <span className={styles.brand}>RoboCC</span>
        <span className={styles.statusBadge} style={{ color: STATUS_COLOR[status] }}>
          ● {status}
        </span>
      </div>

      <div className={styles.body}>
        {/* Telemetry */}
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Telemetry</div>
          <Row label="X" value={position.x.toFixed(3)} unit="m" />
          <Row label="Z" value={position.z.toFixed(3)} unit="m" />
          <Row label="Heading" value={deg} unit="deg" />
          <Row label="Speed" value={velocity.toFixed(2)} unit="m/s" />
        </div>

        {/* Motors */}
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Motors</div>
          <MotorBar label="L" value={motorLeft} />
          <MotorBar label="R" value={motorRight} />
        </div>

        {/* Sensors */}
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Sensors</div>
          <Row label="Front" value={sensors.frontDistance ?? '--'} unit="cm" />
          <Row label="Left"  value={sensors.leftDistance  ?? '--'} unit="cm" />
          <Row label="Right" value={sensors.rightDistance ?? '--'} unit="cm" />
          <Row label="Batt"  value={sensors.battery} unit="%" />
        </div>

        {/* Joint Control */}
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Joint Control</div>
          {JOINT_DEFS.map((def, i) => (
            <JointSlider
              key={def.label}
              def={def}
              value={joints[i]}
              onChange={(v) => setJoint(i, v)}
            />
          ))}
        </div>

        {/* Log */}
        <div className={`${styles.panel} ${styles.logPanel}`}>
          <div className={styles.panelTitle}>Log</div>
          {logs.length === 0 && <div className={styles.muted}>No entries</div>}
          {logs.slice(0, 12).map((l) => (
            <div key={l.id} className={styles.logEntry} data-level={l.level}>
              <span className={styles.logTs}>{l.ts.slice(11, 19)}</span>
              {l.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, unit }) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>
        {value}<span className={styles.unit}> {unit}</span>
      </span>
    </div>
  )
}

function JointSlider({ def, value, onChange }) {
  return (
    <div className={styles.jointRow}>
      <div className={styles.jointHeader}>
        <span className={styles.jointLabel}>{def.label}</span>
        <span className={styles.jointAxis}>{def.axis}</span>
        <span className={styles.jointValue}>{value.toFixed(1)}<span className={styles.unit}> °</span></span>
      </div>
      <div className={styles.sliderWrap}>
        <input
          type="range"
          className={styles.slider}
          min={def.min}
          max={def.max}
          step={0.1}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
        <div className={styles.sliderLimits}>
          <span>{def.min}°</span>
          <span>{def.max}°</span>
        </div>
      </div>
    </div>
  )
}

function MotorBar({ label, value }) {
  const pct = Math.abs(value) * 50
  const isPos = value >= 0
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <div className={styles.motorTrack}>
        <div
          className={styles.motorFill}
          style={{
            width: `${pct}%`,
            left: isPos ? '50%' : `${50 - pct}%`,
            background: isPos ? 'var(--ok)' : 'var(--danger)',
          }}
        />
        <div className={styles.motorCenter} />
      </div>
      <span className={styles.value}>{value.toFixed(2)}</span>
    </div>
  )
}
