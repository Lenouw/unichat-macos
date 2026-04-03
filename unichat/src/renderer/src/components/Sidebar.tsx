import { SERVICES, Service } from '../config/services'

interface SidebarProps {
  activeId: string
  badges: Record<string, number>
  onSelect: (id: string) => void
}

export function Sidebar({ activeId, badges, onSelect }: SidebarProps) {
  return (
    <aside className="flex flex-col w-16 bg-[#111] border-r border-white/10 pt-10 pb-4 items-center gap-2 shrink-0">
      {SERVICES.map((service) => (
        <ServiceButton
          key={service.id}
          service={service}
          isActive={activeId === service.id}
          badge={badges[service.id] ?? 0}
          onClick={() => onSelect(service.id)}
        />
      ))}
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
  const initials = service.label
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <button
      onClick={onClick}
      title={service.label}
      className={`relative w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold
        transition-all duration-150 cursor-default select-none
        ${isActive ? 'ring-2 ring-white/40 scale-105' : 'opacity-60 hover:opacity-90'}`}
      style={{ backgroundColor: service.color }}
    >
      {initials}
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold
          rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}
