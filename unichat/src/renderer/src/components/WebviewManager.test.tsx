// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { WebviewManager } from './WebviewManager'
import { Account } from '../config/accounts'

vi.stubGlobal('unichat', { notify: vi.fn() })

const TEAMS: Account = {
  id: 'teams', serviceKey: 'teams', label: 'Teams', color: '#6264A7',
  url: 'https://teams.microsoft.com', partition: 'persist:teams',
}

describe('WebviewManager', () => {
  afterEach(() => cleanup())

  // Régression 2026-09-27 : allowpopups={true} était ignoré par React, donc absent
  // du DOM. Electron refusait alors toute popup (connexion Teams, liens externes).
  it('pose allowpopups dans le DOM de la webview', () => {
    const { container } = render(
      <WebviewManager accounts={[TEAMS]} activeId="teams" onBadgeChange={vi.fn()} onSenderChange={vi.fn()} />
    )
    const webview = container.querySelector('webview')
    expect(webview).not.toBeNull()
    expect(webview!.getAttribute('allowpopups')).toBe('true')
  })
})
