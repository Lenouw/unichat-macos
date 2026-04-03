import { useState } from 'react'
import { SERVICE_TYPES, ServiceType } from '../config/serviceTypes'

const COLOR_PALETTE = [
  '#25D366', '#128C7E', '#075E54',
  '#0099FF', '#2CA5E0', '#0077B5',
  '#6264A7', '#5865F2', '#7B68EE',
  '#E1306C', '#FF6B9D', '#FF6B35',
  '#4A154B', '#FF9500', '#FF3B30',
]

interface AddAccountModalProps {
  onAdd: (serviceKey: string, label: string, color: string) => void
  onClose: () => void
}

export function AddAccountModal({ onAdd, onClose }: AddAccountModalProps) {
  const [selectedType, setSelectedType] = useState<ServiceType | null>(null)
  const [label, setLabel] = useState('')
  const [color, setColor] = useState('')

  const handleSelectType = (type: ServiceType) => {
    setSelectedType(type)
    setLabel(type.name)
    setColor(type.color)
  }

  const handleAdd = () => {
    if (!selectedType || !label.trim()) return
    onAdd(selectedType.key, label.trim(), color)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#161618',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14,
          padding: '24px',
          width: 460,
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 32px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            color: '#fff',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            marginBottom: 4,
          }}>
            Ajouter un compte
          </div>
          <div style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.4)',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          }}>
            Choisis le service, puis personnalise le nom
          </div>
        </div>

        {/* Grille de services */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          marginBottom: 20,
        }}>
          {SERVICE_TYPES.map((type) => {
            const isSelected = selectedType?.key === type.key
            return (
              <button
                key={type.key}
                onClick={() => handleSelectType(type)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: '12px 8px',
                  background: isSelected ? `${type.color}20` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isSelected ? type.color : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 10,
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'
                }}
              >
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: type.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  boxShadow: isSelected ? `0 0 12px ${type.color}60` : 'none',
                }}>
                  {type.emoji}
                </div>
                <div style={{
                  fontSize: 11,
                  color: isSelected ? '#fff' : 'rgba(255,255,255,0.55)',
                  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                  fontWeight: isSelected ? 600 : 400,
                  textAlign: 'center',
                  lineHeight: 1.2,
                }}>
                  {type.name}
                </div>
              </button>
            )
          })}
        </div>

        {/* Formulaire (visible après sélection) */}
        {selectedType && (
          <>
            {/* Nom du compte */}
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontFamily: 'ui-monospace, "SF Mono", monospace',
                marginBottom: 8,
              }}>
                Nom du compte
              </div>
              <input
                autoFocus
                value={label}
                onChange={(e) => setLabel(e.target.value.slice(0, 100))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
                placeholder={selectedType.name}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${selectedType.color}60`,
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 14,
                  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                  padding: '10px 12px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Palette de couleurs */}
            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontFamily: 'ui-monospace, "SF Mono", monospace',
                marginBottom: 8,
              }}>
                Couleur
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: c,
                      border: color === c ? '2px solid #fff' : '2px solid transparent',
                      cursor: 'pointer',
                      padding: 0,
                      boxShadow: color === c ? `0 0 8px ${c}` : 'none',
                      transition: 'all 120ms ease',
                    }}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Boutons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: 'rgba(255,255,255,0.6)',
              fontSize: 13,
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              cursor: 'pointer',
            }}
          >
            Annuler
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedType || !label.trim()}
            style={{
              padding: '8px 18px',
              background: selectedType ? selectedType.color : 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              cursor: selectedType && label.trim() ? 'pointer' : 'default',
              opacity: !selectedType || !label.trim() ? 0.4 : 1,
              transition: 'all 150ms ease',
            }}
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  )
}
