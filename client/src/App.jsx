import { useEffect } from 'react'
import Scene from './components/Scene'
import HUD from './components/HUD'
import StatusBar from './components/StatusBar'
import { initSocket } from './socket'
import './App.css'

export default function App() {
  useEffect(() => {
    initSocket()
  }, [])

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <HUD />
      </aside>
      <main className="app-viewport">
        <Scene />
      </main>
      <footer className="app-statusbar">
        <StatusBar />
      </footer>
    </div>
  )
}
