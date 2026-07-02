// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { parseBadgeFromTitle } from './badge'

describe('parseBadgeFromTitle', () => {
  it('retourne 0 pour un titre sans badge', () => {
    expect(parseBadgeFromTitle('WhatsApp')).toBe(0)
  })

  it('extrait le count depuis "(3) WhatsApp"', () => {
    expect(parseBadgeFromTitle('(3) WhatsApp')).toBe(3)
  })

  it('extrait le count depuis "(5) Microsoft Teams"', () => {
    expect(parseBadgeFromTitle('(5) Microsoft Teams')).toBe(5)
  })

  it('extrait le count depuis "(12) Messenger"', () => {
    expect(parseBadgeFromTitle('(12) Messenger')).toBe(12)
  })

  it('gère le format "(99+)"', () => {
    expect(parseBadgeFromTitle('(99+) WhatsApp')).toBe(99)
  })

  it('retourne 0 pour un titre vide', () => {
    expect(parseBadgeFromTitle('')).toBe(0)
  })

  it('ignore les parenthèses au milieu du titre (pas de badge fantôme)', () => {
    expect(parseBadgeFromTitle('Réunion (3 participants) | Microsoft Teams')).toBe(0)
    expect(parseBadgeFromTitle('Chat (2) | Teams')).toBe(0)
  })

  describe('Slack (jamais de count dans le titre, préfixe * ou !)', () => {
    it('retourne 1 quand le titre commence par *', () => {
      expect(parseBadgeFromTitle('* Slack | général', 'slack')).toBe(1)
    })

    it('retourne 1 quand le titre commence par !', () => {
      expect(parseBadgeFromTitle('! Slack | général', 'slack')).toBe(1)
    })

    it('retourne 0 sans marqueur', () => {
      expect(parseBadgeFromTitle('Slack | général', 'slack')).toBe(0)
    })
  })
})
