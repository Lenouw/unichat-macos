import { useState, useCallback, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { WebviewManager } from './components/WebviewManager'
import { SERVICES } from './config/services'

export default function App() {
  const [activeId, setActiveId] = useState(SERVICES[0].id)
  const [badges, setBadges] = useState<Record<string, number>>({})
  const [lastSenders, setLastSenders] = useState<Record<string, string>>({})

  const handleBadgeChange = useCallback((serviceId: string, count: number) => {
    setBadges((prev) => {
      if (prev[serviceId] === count) return prev
      const next = { ...prev, [serviceId]: count }
      window.unichat.setBadge(serviceId, count)
      return next
    })
  }, [])

  const handleSenderChange = useCallback((serviceId: string, sender: string) => {
    setLastSenders((prev) =>
      prev[serviceId] === sender ? prev : { ...prev, [serviceId]: sender }
    )
  }, [])

  useEffect(() => {
    const cleanup = window.unichat.onServiceSelect((id) => {
      setActiveId(id)
    })
    return cleanup
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Sidebar
        activeId={activeId}
        badges={badges}
        lastSenders={lastSenders}
        onSelect={setActiveId}
      />
      <WebviewManager
        activeId={activeId}
        onBadgeChange={handleBadgeChange}
        onSenderChange={handleSenderChange}
      />
    </div>
  )
}
