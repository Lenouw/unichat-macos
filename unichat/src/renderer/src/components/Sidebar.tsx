import { SERVICES, Service } from '../config/services'

interface SidebarProps {
  activeId: string
  badges: Record<string, number>
  lastSenders: Record<string, string>
  onSelect: (id: string) => void
}

const WA_IDS = new Set(['wa-perso', 'wa-pro1', 'wa-pro2'])

function isColorDark(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 < 128
}

export function Sidebar({ activeId, badges, lastSenders, onSelect }: SidebarProps) {
  const waServices = SERVICES.filter((s) => WA_IDS.has(s.id))
  const otherServices = SERVICES.filter((s) => !WA_IDS.has(s.id))

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

      {/* Groupe WhatsApp */}
      <ServiceGroup>
        {waServices.map((service) => (
          <ServiceRow
            key={service.id}
            service={service}
            isActive={activeId === service.id}
            badge={badges[service.id] ?? 0}
            lastSender={lastSenders[service.id] ?? ''}
            onClick={() => onSelect(service.id)}
          />
        ))}
      </ServiceGroup>

      {/* Séparateur */}
      <div style={{
        height: 1,
        background: 'rgba(255,255,255,0.06)',
        margin: '6px 16px',
      }} />

      {/* Messenger + Teams */}
      <ServiceGroup>
        {otherServices.map((service) => (
          <ServiceRow
            key={service.id}
            service={service}
            isActive={activeId === service.id}
            badge={badges[service.id] ?? 0}
            lastSender={lastSenders[service.id] ?? ''}
            onClick={() => onSelect(service.id)}
          />
        ))}
      </ServiceGroup>
    </aside>
  )
}

function ServiceGroup({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '2px 0' }}>
      {children}
    </div>
  )
}

function ServiceRow({
  service,
  isActive,
  badge,
  lastSender,
  onClick,
}: {
  service: Service
  isActive: boolean
  badge: number
  lastSender: string
  onClick: () => void
}) {
  const badgeText = badge > 99 ? '99+' : String(badge)
  const badgeTextColor = isColorDark(service.color) ? '#fff' : '#111'
  const subtext = lastSender || (badge > 0 ? `${badge} non lu${badge > 1 ? 's' : ''}` : '')

  return (
    <button
      onClick={onClick}
      title={service.label}
      style={{
        WebkitAppRegion: 'no-drag',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 14px 9px 16px',
        background: isActive ? `${service.color}10` : 'transparent',
        border: 'none',
        borderLeft: `3px solid ${isActive ? service.color : 'transparent'}`,
        cursor: 'default',
        width: '100%',
        textAlign: 'left',
        transition: 'background 150ms ease',
        minHeight: 52,
      } as React.CSSProperties}
      onMouseEnter={(e) => {
        if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'
      }}
      onMouseLeave={(e) => {
        if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
      }}
    >
      {/* Dot indicateur */}
      <div style={{
        width: isActive ? 8 : 7,
        height: isActive ? 8 : 7,
        borderRadius: '50%',
        background: service.color,
        opacity: isActive ? 1 : 0.45,
        flexShrink: 0,
        boxShadow: isActive ? `0 0 8px ${service.color}` : 'none',
        transition: 'all 180ms ease',
      }} />

      {/* Texte */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
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
          {service.label}
        </div>
        {subtext && (
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

      {/* Badge */}
      {badge > 0 && (
        <div style={{
          flexShrink: 0,
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          background: service.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 5px',
          fontSize: 10,
          fontWeight: 700,
          fontFamily: 'ui-monospace, "SF Mono", monospace',
          color: badgeTextColor,
          letterSpacing: '-0.02em',
          boxShadow: `0 0 8px ${service.color}50`,
        }}>
          {badgeText}
        </div>
      )}
    </button>
  )
}
