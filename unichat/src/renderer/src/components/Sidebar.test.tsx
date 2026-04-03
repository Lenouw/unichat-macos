// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Sidebar } from './Sidebar'

vi.stubGlobal('unichat', { setBadge: vi.fn(), notify: vi.fn(), onServiceSelect: vi.fn() })

describe('Sidebar', () => {
  afterEach(() => {
    cleanup()
  })

  const defaultProps = {
    activeId: 'wa-perso',
    badges: {},
    onSelect: vi.fn(),
  }

  it('affiche 5 boutons de service', () => {
    render(<Sidebar {...defaultProps} />)
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })

  it('affiche les labels en title sur les boutons', () => {
    render(<Sidebar {...defaultProps} />)
    expect(screen.getByTitle('WhatsApp Perso')).toBeDefined()
    expect(screen.getByTitle('Messenger')).toBeDefined()
    expect(screen.getByTitle('Teams')).toBeDefined()
  })

  it('appelle onSelect avec le bon id au clic', () => {
    const onSelect = vi.fn()
    render(<Sidebar {...defaultProps} onSelect={onSelect} />)
    fireEvent.click(screen.getByTitle('Messenger'))
    expect(onSelect).toHaveBeenCalledWith('messenger')
  })

  it('affiche un badge quand count > 0', () => {
    render(<Sidebar {...defaultProps} badges={{ 'wa-perso': 3 }} />)
    expect(screen.getByText('3')).toBeDefined()
  })

  it('affiche 99+ pour les badges > 99', () => {
    render(<Sidebar {...defaultProps} badges={{ messenger: 150 }} />)
    expect(screen.getByText('99+')).toBeDefined()
  })

  it("n'affiche pas de badge quand count === 0", () => {
    render(<Sidebar {...defaultProps} badges={{ 'wa-perso': 0 }} />)
    expect(screen.queryByText('0')).toBeNull()
  })
})
