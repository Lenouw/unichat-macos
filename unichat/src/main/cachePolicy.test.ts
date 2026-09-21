import { describe, it, expect } from 'vitest'
import { shouldPurge, CACHE_LIMIT_BYTES } from './cachePolicy'

describe('shouldPurge', () => {
  it('purge au-dessus du plafond', () => {
    expect(shouldPurge(CACHE_LIMIT_BYTES + 1)).toBe(true)
  })

  it('ne purge pas en dessous ou au plafond exact', () => {
    expect(shouldPurge(CACHE_LIMIT_BYTES)).toBe(false)
    expect(shouldPurge(CACHE_LIMIT_BYTES - 1)).toBe(false)
  })

  it('ignore les tailles nulles ou illisibles', () => {
    expect(shouldPurge(0)).toBe(false)
    expect(shouldPurge(-5)).toBe(false)
    expect(shouldPurge(NaN)).toBe(false)
  })

  it('accepte un plafond explicite', () => {
    expect(shouldPurge(200, 100)).toBe(true)
    expect(shouldPurge(50, 100)).toBe(false)
  })
})
