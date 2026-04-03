import { useState, useCallback, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { WebviewManager } from './components/WebviewManager'
import { SERVICES } from './config/services'

export default function App() {
  const [activeId, setActiveId] = useState(SERVICES[0].id)
  const [badges, setBadges] = useState<Record<string, number>>({})

  const handleBadgeChange = useCallback((serviceId: string, count: number) => {
    setBadges((prev) => {
      if (prev[serviceId] === count) return prev
      const next = { ...prev, [serviceId]: count }
      window.unichat.setBadge(serviceId, count)
      return next
    })
  }, [])

  useEffect(() => {
    const cleanup = window.unichat.onServiceSelect((id) => {
      setActiveId(id)
    })
    return cleanup
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar activeId={activeId} badges={badges} onSelect={setActiveId} />
      <WebviewManager activeId={activeId} onBadgeChange={handleBadgeChange} />
    </div>
  )
}
