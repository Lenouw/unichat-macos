import { useState, useRef, useEffect } from 'react'
import { Account } from '../config/accounts'
import { SERVICE_TYPES } from '../config/serviceTypes'
import { APP_VERSION } from '../config/version'

type UpdateStatus = 'idle' | 'checking' | 'available' | 'progress' | 'ready' | 'not-available'

interface SidebarProps {
  accounts: Account[]
  activeId: string
  badges: Record<string, number>
  lastSenders: Record<string, string>
  onSelect: (id: string) => void
  onAddAccount: () => void
  onDeleteAccount: (id: string) => void
  onRenameAccount: (id: string, newLabel: string) => void
  updateStatus: UpdateStatus
  updateVersion?: string
  updateProgress: number
  onInstallUpdate: () => void
}

function isColorDark(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 < 128
}

export function Sidebar({
  accounts,
  activeId,
  badges,
  lastSenders,
  onSelect,
  onAddAccount,
  onDeleteAccount,
  onRenameAccount,
  updateStatus,
  updateVersion,
  updateProgress,
  onInstallUpdate,
}: SidebarProps) {
  return (
    <aside
      style={{
        width: 260,
        minWidth: 260,
        height: '100vh',
        background: '#0d0d0e',
        borderRight: '1px solid rgba(255,255,255,0.055)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        paddingTop: 44,
        paddingBottom: 20,
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      {/* Header */}
      <div style={{
        padding: '0 16px 14px',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.1em',
        color: 'rgba(255,255,255,0.2)',
        fontFamily: 'ui-monospace, "SF Mono", monospace',
        textTransform: 'uppercase',
      }}>
        UniChat
      </div>

      {/* Liste des comptes (scrollable) */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {accounts.map((account) => (
          <ServiceRow
            key={account.id}
            account={account}
            isActive={activeId === account.id}
            badge={badges[account.id] ?? 0}
            lastSender={lastSenders[account.id] ?? ''}
            onClick={() => onSelect(account.id)}
            onDelete={() => onDeleteAccount(account.id)}
            onRename={(newLabel) => onRenameAccount(account.id, newLabel)}
          />
        ))}
      </div>

      {/* Bloc mise à jour */}
      <UpdateBanner
        status={updateStatus}
        version={updateVersion}
        progress={updateProgress}
        onInstall={onInstallUpdate}
      />

      {/* Version */}
      <div style={{
        padding: '4px 16px 4px',
        fontSize: 10,
        color: 'rgba(255,255,255,0.15)',
        fontFamily: 'ui-monospace, "SF Mono", monospace',
        letterSpacing: '0.05em',
      }}>
        v{APP_VERSION}
      </div>

      {/* Bouton Ajouter un compte */}
      <div style={{ padding: '4px 12px 0' }}>
        <button
          onClick={onAddAccount}
          style={{
            WebkitAppRegion: 'no-drag',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 12px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px dashed rgba(255,255,255,0.12)',
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'all 150ms ease',
          } as React.CSSProperties}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.22)'
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.12)'
          }}
        >
          <div style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            color: 'rgba(255,255,255,0.4)',
            flexShrink: 0,
          }}>
            +
          </div>
          <span style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.35)',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          }}>
            Ajouter un compte
          </span>
        </button>
      </div>
    </aside>
  )
}

function UpdateBanner({
  status,
  version,
  progress,
  onInstall,
}: {
  status: UpdateStatus
  version?: string
  progress: number
  onInstall: () => void
}) {
  if (status === 'idle' || status === 'checking' || status === 'not-available') return null

  const isReady = status === 'ready'
  const isDownloading = status === 'progress'
  const isAvailable = status === 'available'

  return (
    <div style={{
      margin: '0 12px 4px',
      padding: '10px 12px',
      background: isReady ? 'rgba(52,199,89,0.12)' : 'rgba(255,149,0,0.1)',
      border: `1px solid ${isReady ? 'rgba(52,199,89,0.3)' : 'rgba(255,149,0,0.25)'}`,
      borderRadius: 8,
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: isReady ? '#34C759' : '#FF9500',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        marginBottom: 4,
      }}>
        {isReady && `v${version} prête à installer`}
        {isAvailable && `v${version} disponible`}
        {isDownloading && `Téléchargement… ${progress}%`}
      </div>

      {isDownloading && (
        <div style={{
          height: 3,
          background: 'rgba(255,149,0,0.2)',
          borderRadius: 2,
          overflow: 'hidden',
          marginBottom: 6,
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: '#FF9500',
            borderRadius: 2,
            transition: 'width 300ms ease',
          }} />
        </div>
      )}

      {isReady && (
        <button
          onClick={onInstall}
          style={{
            WebkitAppRegion: 'no-drag',
            width: '100%',
            padding: '5px 0',
            background: '#34C759',
            border: 'none',
            borderRadius: 5,
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            cursor: 'pointer',
          } as React.CSSProperties}
        >
          Redémarrer pour installer
        </button>
      )}
    </div>
  )
}

function ServiceIcon({ account, isActive }: { account: Account; isActive: boolean }) {
  const serviceType = SERVICE_TYPES.find((s) => s.key === account.serviceKey)
  const emoji = serviceType?.emoji ?? '💬'
  const firstLetter = account.label.trim().charAt(0).toUpperCase()

  return (
    <div style={{ position: 'relative', flexShrink: 0, width: 34, height: 34 }}>
      {/* Cercle coloré avec l'emoji du service */}
      <div style={{
        width: 34,
        height: 34,
        borderRadius: '50%',
        background: `${account.color}${isActive ? 'cc' : '55'}`,
        border: `1.5px solid ${account.color}${isActive ? 'ff' : '80'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16,
        boxShadow: isActive ? `0 0 10px ${account.color}60` : 'none',
        transition: 'all 180ms ease',
      }}>
        {emoji}
      </div>
      {/* Badge lettre du compte (ex: P pour Perso, B pour Business) */}
      <div style={{
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: account.color,
        border: '1.5px solid #0d0d0e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 8,
        fontWeight: 700,
        color: '#fff',
        fontFamily: 'ui-monospace, "SF Mono", monospace',
        letterSpacing: 0,
      }}>
        {firstLetter}
      </div>
    </div>
  )
}

function ServiceRow({
  account,
  isActive,
  badge,
  lastSender,
  onClick,
  onDelete,
  onRename,
}: {
  account: Account
  isActive: boolean
  badge: number
  lastSender: string
  onClick: () => void
  onDelete: () => void
  onRename: (newLabel: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(account.label)
  const [hovered, setHovered] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (editing) {
      setDraft(account.label)
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [editing, account.label])

  // Reset confirmation de suppression après 2s sans 2e clic
  useEffect(() => {
    if (confirmDelete) {
      deleteTimerRef.current = setTimeout(() => setConfirmDelete(false), 2000)
    }
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
    }
  }, [confirmDelete])

  const commit = () => {
    setEditing(false)
    if (draft.trim()) onRename(draft.trim())
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirmDelete) {
      onDelete()
    } else {
      setConfirmDelete(true)
    }
  }

  const badgeText = badge > 99 ? '99+' : String(badge)
  const badgeTextColor = isColorDark(account.color) ? '#fff' : '#111'
  const subtext = lastSender || (badge > 0 ? `${badge} non lu${badge > 1 ? 's' : ''}` : '')

  return (
    <button
      onClick={editing ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirmDelete(false) }}
      style={{
        WebkitAppRegion: 'no-drag',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 14px 9px 16px',
        background: isActive ? `${account.color}10` : hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        border: 'none',
        borderLeft: `3px solid ${isActive ? account.color : 'transparent'}`,
        cursor: 'default',
        width: '100%',
        textAlign: 'left',
        transition: 'background 150ms ease',
        minHeight: 52,
      } as React.CSSProperties}
    >
      {/* Icône service + lettre du compte */}
      <ServiceIcon account={account} isActive={isActive} />

      {/* Texte */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 100))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') setEditing(false)
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.08)',
              border: `1px solid ${account.color}`,
              borderRadius: 4,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              padding: '2px 6px',
              outline: 'none',
            }}
          />
        ) : (
          <div
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}
            title={account.label}
            style={{
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
              letterSpacing: '-0.01em',
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.3,
              transition: 'color 150ms ease, font-weight 150ms ease',
            }}>
            {account.label}
          </div>
        )}
        {!editing && subtext && (
          <div style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.35)',
            marginTop: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            lineHeight: 1.2,
          }}>
            {subtext}
          </div>
        )}
      </div>

      {/* Badge OU bouton supprimer (au hover) */}
      {!editing && hovered ? (
        <button
          onClick={handleDeleteClick}
          title={confirmDelete ? 'Cliquer pour confirmer' : 'Supprimer ce compte'}
          style={{
            flexShrink: 0,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: confirmDelete ? '#FF3B30' : 'rgba(255,255,255,0.1)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: 12,
            color: confirmDelete ? '#fff' : 'rgba(255,255,255,0.5)',
            transition: 'all 150ms ease',
            padding: 0,
          }}
        >
          {confirmDelete ? '!' : '×'}
        </button>
      ) : badge > 0 && !editing ? (
        <div style={{
          flexShrink: 0,
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          background: account.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 5px',
          fontSize: 10,
          fontWeight: 700,
          fontFamily: 'ui-monospace, "SF Mono", monospace',
          color: badgeTextColor,
          letterSpacing: '-0.02em',
          boxShadow: `0 0 8px ${account.color}50`,
        }}>
          {badgeText}
        </div>
      ) : null}
    </button>
  )
}
