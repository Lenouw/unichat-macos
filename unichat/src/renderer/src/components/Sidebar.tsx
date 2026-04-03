import { SERVICES, Service } from '../config/services'

interface SidebarProps {
  activeId: string
  badges: Record<string, number>
  onSelect: (id: string) => void
}

const WA_IDS = new Set(['wa-perso', 'wa-pro1', 'wa-pro2'])

function isColorDark(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 < 128
}

export function Sidebar({ activeId, badges, onSelect }: SidebarProps) {
  const waServices = SERVICES.filter((s) => WA_IDS.has(s.id))
  const otherServices = SERVICES.filter((s) => !WA_IDS.has(s.id))

  return (
    <aside
      style={{
        width: 56,
        minWidth: 56,
        height: '100vh',
        background: '#0a0a0b',
        borderRight: '1px solid rgba(255,255,255,0.055)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flexShrink: 0,
        paddingTop: 44,
        paddingBottom: 20,
        userSelect: 'none',
      }}
    >
      {/* Monogramme */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: 'rgba(255,255,255,0.18)',
          fontFamily: 'ui-monospace, "SF Mono", monospace',
          marginBottom: 18,
        }}
      >
        UC
      </div>

      {/* Groupe WhatsApp */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%', alignItems: 'center' }}>
        {waServices.map((service) => (
          <ServiceButton
            key={service.id}
            service={service}
            isActive={activeId === service.id}
            badge={badges[service.id] ?? 0}
            onClick={() => onSelect(service.id)}
          />
        ))}
      </div>

      {/* Séparateur */}
      <div
        style={{
          width: 20,
          height: 1,
          background: 'rgba(255,255,255,0.07)',
          margin: '10px 0',
        }}
      />

      {/* Messenger + Teams */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%', alignItems: 'center' }}>
        {otherServices.map((service) => (
          <ServiceButton
            key={service.id}
            service={service}
            isActive={activeId === service.id}
            badge={badges[service.id] ?? 0}
            onClick={() => onSelect(service.id)}
          />
        ))}
      </div>
    </aside>
  )
}

function ServiceButton({
  service,
  isActive,
  badge,
  onClick,
}: {
  service: Service
  isActive: boolean
  badge: number
  onClick: () => void
}) {
  const initial = service.label[0].toUpperCase()
  const badgeText = badge > 99 ? '99+' : String(badge)
  const badgeTextColor = isColorDark(service.color) ? '#fff' : '#000'

  return (
    <div
      style={{
        position: 'relative',
        width: 40,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* Barre d'accent gauche */}
      <div
        style={{
          position: 'absolute',
          left: -8,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 2.5,
          height: isActive ? 22 : 0,
          borderRadius: 2,
          background: service.color,
          transition: 'height 220ms cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isActive ? `0 0 8px ${service.color}` : 'none',
        }}
      />

      {/* Bouton principal */}
      <button
        className="service-btn"
        onClick={onClick}
        title={service.label}
        style={{
          width: 40,
          height: 40,
          borderRadius: 11,
          border: 'none',
          outline: 'none',
          cursor: 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 15,
          fontWeight: 600,
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          letterSpacing: '-0.01em',
          transition: 'background 180ms ease, box-shadow 180ms ease, color 180ms ease, opacity 180ms ease',
          background: isActive ? service.color : 'transparent',
          color: isActive ? (isColorDark(service.color) ? '#fff' : '#111') : service.color,
          opacity: isActive ? 1 : 0.5,
          boxShadow: isActive
            ? `0 0 20px ${service.color}35, 0 4px 12px rgba(0,0,0,0.5)`
            : 'none',
        }}
        onMouseEnter={(e) => {
          if (isActive) return
          const el = e.currentTarget as HTMLButtonElement
          el.style.background = `${service.color}16`
          el.style.opacity = '0.8'
        }}
        onMouseLeave={(e) => {
          if (isActive) return
          const el = e.currentTarget as HTMLButtonElement
          el.style.background = 'transparent'
          el.style.opacity = '0.5'
        }}
      >
        {initial}
      </button>

      {/* Badge */}
      {badge > 0 && (
        <div
          style={{
            position: 'absolute',
            top: -2,
            right: -4,
            minWidth: 15,
            height: 14,
            borderRadius: 7,
            background: service.color,
            border: '1.5px solid #0a0a0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingLeft: 3,
            paddingRight: 3,
            fontSize: 8.5,
            fontWeight: 700,
            fontFamily: 'ui-monospace, "SF Mono", monospace',
            color: badgeTextColor,
            letterSpacing: '-0.02em',
            boxShadow: `0 0 8px ${service.color}60`,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {badgeText}
        </div>
      )}
    </div>
  )
}
