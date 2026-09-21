import { describe, it, expect } from 'vitest'
import { formatBytes } from './formatBytes'

describe('formatBytes', () => {
  it('affiche les mégaoctets en dessous de 1 Go', () => {
    expect(formatBytes(340 * 1024 * 1024)).toBe('340 Mo')
  })

  it('bascule en gigaoctets au-delà de 1024 Mo', () => {
    expect(formatBytes(7.6 * 1024 * 1024 * 1024)).toBe('7.6 Go')
  })

  it('regroupe les tailles négligeables', () => {
    expect(formatBytes(50 * 1024)).toBe('< 1 Mo')
  })

  it('gère zéro et les valeurs invalides sans planter', () => {
    expect(formatBytes(0)).toBe('0 Mo')
    expect(formatBytes(-1)).toBe('0 Mo')
    expect(formatBytes(NaN)).toBe('0 Mo')
  })
})
