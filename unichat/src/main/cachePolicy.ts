/**
 * Politique de cache, sans dépendance à Electron pour rester testable.
 * Les opérations sur les sessions vivent dans cacheManager.ts.
 */

/** Plafond par compte au-delà duquel le cache est purgé au démarrage. */
export const CACHE_LIMIT_BYTES = 100 * 1024 * 1024

/** Décide si une session mérite une purge. */
export function shouldPurge(sizeBytes: number, limitBytes: number = CACHE_LIMIT_BYTES): boolean {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return false
  return sizeBytes > limitBytes
}
