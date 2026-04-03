// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { parseBadgeFromTitle } from './badge'

describe('parseBadgeFromTitle', () => {
  it('retourne 0 pour un titre sans badge', () => {
    expect(parseBadgeFromTitle('WhatsApp')).toBe(0)
  })

  it('extrait le count depuis "WhatsApp (3)"', () => {
    expect(parseBadgeFromTitle('WhatsApp (3)')).toBe(3)
  })

  it('extrait le count depuis "(5) Microsoft Teams"', () => {
    expect(parseBadgeFromTitle('(5) Microsoft Teams')).toBe(5)
  })

  it('extrait le count depuis "Messenger (12)"', () => {
    expect(parseBadgeFromTitle('Messenger (12)')).toBe(12)
  })

  it('retourne 0 pour un titre vide', () => {
    expect(parseBadgeFromTitle('')).toBe(0)
  })
})
