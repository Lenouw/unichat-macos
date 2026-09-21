// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Sidebar } from './Sidebar'
import { Account } from '../config/accounts'

vi.stubGlobal('unichat', {
  setBadge: vi.fn(),
  notify: vi.fn(),
  onServiceSelect: vi.fn(),
  registerAccounts: vi.fn(),
  clearSession: vi.fn(),
  getCacheSize: vi.fn(() => Promise.resolve(340 * 1024 * 1024)),
  purgeCache: vi.fn(() => Promise.resolve(340 * 1024 * 1024)),
  onUpdateStatus: vi.fn(() => () => {}),
  installUpdate: vi.fn(),
  openExternal: vi.fn(),
})

const MOCK_ACCOUNTS: Account[] = [
  { id: 'wa-perso', serviceKey: 'whatsapp', label: 'WhatsApp Perso', color: '#25D366', url: 'https://web.whatsapp.com', partition: 'persist:wa-perso' },
  { id: 'wa-pro1', serviceKey: 'whatsapp', label: 'WhatsApp Pro 1', color: '#128C7E', url: 'https://web.whatsapp.com', partition: 'persist:wa-pro1' },
  { id: 'wa-pro2', serviceKey: 'whatsapp', label: 'WhatsApp Pro 2', color: '#075E54', url: 'https://web.whatsapp.com', partition: 'persist:wa-pro2' },
  { id: 'messenger', serviceKey: 'messenger', label: 'Messenger', color: '#0099FF', url: 'https://www.messenger.com', partition: 'persist:messenger' },
  { id: 'teams', serviceKey: 'teams', label: 'Teams', color: '#6264A7', url: 'https://teams.microsoft.com', partition: 'persist:teams' },
]

describe('Sidebar', () => {
  afterEach(() => {
    cleanup()
  })

  const defaultProps = {
    accounts: MOCK_ACCOUNTS,
    activeId: 'wa-perso',
    badges: {},
    lastSenders: {},
    onSelect: vi.fn(),
    onAddAccount: vi.fn(),
    onDeleteAccount: vi.fn(),
    onRenameAccount: vi.fn(),
    onReorder: vi.fn(),
    updateStatus: 'idle' as const,
    updateVersion: undefined,
    updateProgress: 0,
    onInstallUpdate: vi.fn(),
  }

  it('affiche 5 boutons de service + 1 bouton ajouter', () => {
    render(<Sidebar {...defaultProps} />)
    // 5 comptes + le bouton "Ajouter un compte"
    expect(screen.getAllByRole('button')).toHaveLength(6)
  })

  it('affiche les labels des comptes', () => {
    render(<Sidebar {...defaultProps} />)
    expect(screen.getByText('WhatsApp Perso')).toBeDefined()
    expect(screen.getByText('Messenger')).toBeDefined()
    expect(screen.getByText('Teams')).toBeDefined()
  })

  it('appelle onSelect avec le bon id au clic', () => {
    const onSelect = vi.fn()
    render(<Sidebar {...defaultProps} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Messenger'))
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

  it('appelle onAddAccount au clic sur le bouton ajouter', () => {
    const onAddAccount = vi.fn()
    render(<Sidebar {...defaultProps} onAddAccount={onAddAccount} />)
    fireEvent.click(screen.getByText('Ajouter un compte'))
    expect(onAddAccount).toHaveBeenCalledOnce()
  })
})

describe('Indicateur de cache', () => {
  const props = {
    accounts: MOCK_ACCOUNTS,
    activeId: 'wa-perso',
    badges: {},
    lastSenders: {},
    onSelect: vi.fn(),
    onAddAccount: vi.fn(),
    onDeleteAccount: vi.fn(),
    onRenameAccount: vi.fn(),
    onReorder: vi.fn(),
    updateStatus: 'idle' as const,
    updateVersion: undefined,
    updateProgress: 0,
    onInstallUpdate: vi.fn(),
  }

  afterEach(() => {
    cleanup()
  })

  it('affiche la taille du cache une fois mesurée', async () => {
    vi.stubGlobal('unichat', {
      ...window.unichat,
      getCacheSize: vi.fn(() => Promise.resolve(340 * 1024 * 1024)),
    })

    render(<Sidebar {...props} />)

    expect(await screen.findByText('Cache 340 Mo')).toBeTruthy()
  })

  it('déclenche la purge au clic et rafraîchit la valeur affichée', async () => {
    const purgeCache = vi.fn(() => Promise.resolve(340 * 1024 * 1024))
    const sizes = [340 * 1024 * 1024, 0]
    vi.stubGlobal('unichat', {
      ...window.unichat,
      purgeCache,
      getCacheSize: vi.fn(() => Promise.resolve(sizes.shift() ?? 0)),
    })

    render(<Sidebar {...props} />)
    fireEvent.click(await screen.findByText('Cache 340 Mo'))

    expect(purgeCache).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Cache 0 Mo')).toBeTruthy()
  })
})
