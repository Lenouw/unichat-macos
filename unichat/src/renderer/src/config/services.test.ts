import { describe, it, expect } from 'vitest'
import { SERVICES } from './services'

describe('SERVICES config', () => {
  it('contient exactement 5 services', () => {
    expect(SERVICES).toHaveLength(5)
  })

  it('chaque service a un id unique', () => {
    const ids = SERVICES.map(s => s.id)
    expect(new Set(ids).size).toBe(SERVICES.length)
  })

  it('chaque service a une partition unique (sessions isolées)', () => {
    const partitions = SERVICES.map(s => s.partition)
    expect(new Set(partitions).size).toBe(SERVICES.length)
  })

  it('les partitions WhatsApp sont toutes différentes', () => {
    const waServices = SERVICES.filter(s => s.id.startsWith('wa-'))
    const waPartitions = waServices.map(s => s.partition)
    expect(new Set(waPartitions).size).toBe(3)
  })

  it('chaque service a une URL valide', () => {
    SERVICES.forEach(s => {
      expect(() => new URL(s.url)).not.toThrow()
    })
  })
})
