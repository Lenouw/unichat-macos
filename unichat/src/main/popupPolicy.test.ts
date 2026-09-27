import { describe, it, expect } from 'vitest'
import { classifyPopup } from './popupPolicy'

describe('classifyPopup', () => {
  it("ouvre dans l'app la popup vide de MSAL", () => {
    expect(classifyPopup('about:blank', 'new-window')).toBe('app')
    expect(classifyPopup('about:blank', 'foreground-tab')).toBe('app')
  })

  it("ouvre dans l'app une popup de connexion Microsoft", () => {
    expect(classifyPopup('https://login.microsoftonline.com/common/oauth2', 'new-window')).toBe('app')
  })

  it("ouvre dans l'app un serveur d'identité d'entreprise inconnu", () => {
    expect(classifyPopup('https://sts.entreprise-exemple.com/adfs/ls', 'new-window')).toBe('app')
  })

  it('envoie les liens target=_blank vers le navigateur', () => {
    expect(classifyPopup('https://example.com/article', 'foreground-tab')).toBe('browser')
    expect(classifyPopup('https://example.com/article', 'background-tab')).toBe('browser')
  })

  it('refuse une popup non https', () => {
    expect(classifyPopup('http://example.com', 'new-window')).toBe('browser')
    expect(classifyPopup('javascript:alert(1)', 'new-window')).toBe('browser')
  })
})
