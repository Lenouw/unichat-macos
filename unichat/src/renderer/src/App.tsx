import { useState, useCallback, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { WebviewManager } from './components/WebviewManager'
import { AddAccountModal } from './components/AddAccountModal'
import { loadAccounts, saveAccounts, createAccount, Account } from './config/accounts'

type UpdateStatus = 'idle' | 'checking' | 'available' | 'progress' | 'ready' | 'not-available'

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>(loadAccounts)
  const [activeId, setActiveId] = useState(() => loadAccounts()[0]?.id ?? '')
  const [badges, setBadges] = useState<Record<string, number>>({})
  const [lastSenders, setLastSenders] = useState<Record<string, string>>({})
  const [showAddModal, setShowAddModal] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [updateVersion, setUpdateVersion] = useState<string | undefined>()
  const [updateProgress, setUpdateProgress] = useState(0)

  // Envoyer les IDs de compte au main process pour les raccourcis Cmd+1-9
  useEffect(() => {
    window.unichat.registerAccounts(accounts.map((a) => a.id))
  }, [accounts])

  // Écouter les événements de mise à jour
  useEffect(() => {
    const cleanup = window.unichat.onUpdateStatus((event, payload) => {
      if (event === 'checking') setUpdateStatus('checking')
      else if (event === 'available') { setUpdateStatus('available'); setUpdateVersion(payload) }
      else if (event === 'not-available') setUpdateStatus('idle')
      else if (event === 'progress') { setUpdateStatus('progress'); setUpdateProgress(Number(payload) || 0) }
      else if (event === 'ready') { setUpdateStatus('ready'); setUpdateVersion(payload) }
    })
    return cleanup
  }, [])

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

  const handleAddAccount = (serviceKey: string, label: string, color: string) => {
    const account = createAccount(serviceKey, label, color)
    const updated = [...accounts, account]
    setAccounts(updated)
    saveAccounts(updated)
    setActiveId(account.id)
    setShowAddModal(false)
  }

  const handleDeleteAccount = (id: string) => {
    const updated = accounts.filter((a) => a.id !== id)
    setAccounts(updated)
    saveAccounts(updated)
    if (activeId === id) {
      setActiveId(updated[0]?.id ?? '')
    }
    // Nettoyer les badges et senders de ce compte
    setBadges((prev) => { const next = { ...prev }; delete next[id]; return next })
    setLastSenders((prev) => { const next = { ...prev }; delete next[id]; return next })
  }

  const handleRenameAccount = (id: string, newLabel: string) => {
    const updated = accounts.map((a) => a.id === id ? { ...a, label: newLabel } : a)
    setAccounts(updated)
    saveAccounts(updated)
  }

  const handleReorder = (fromIndex: number, toIndex: number) => {
    const updated = [...accounts]
    const [moved] = updated.splice(fromIndex, 1)
    updated.splice(toIndex, 0, moved)
    setAccounts(updated)
    saveAccounts(updated)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Sidebar
        accounts={accounts}
        activeId={activeId}
        badges={badges}
        lastSenders={lastSenders}
        onSelect={setActiveId}
        onAddAccount={() => setShowAddModal(true)}
        onDeleteAccount={handleDeleteAccount}
        onRenameAccount={handleRenameAccount}
        onReorder={handleReorder}
        updateStatus={updateStatus}
        updateVersion={updateVersion}
        updateProgress={updateProgress}
        onInstallUpdate={() => window.unichat.installUpdate()}
      />
      <WebviewManager
        accounts={accounts}
        activeId={activeId}
        onBadgeChange={handleBadgeChange}
        onSenderChange={handleSenderChange}
      />
      {showAddModal && (
        <AddAccountModal
          onAdd={handleAddAccount}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}
