import { session } from 'electron'
import { shouldPurge } from './cachePolicy'

/**
 * Gestion du cache disque des partitions.
 *
 * ⚠️ RÈGLE ABSOLUE : ne jamais toucher au dossier "Service Worker"
 * (CacheStorage, ScriptCache) d'une partition.
 *
 * Incident du 2026-09-21 : suppression manuelle de ces dossiers pour récupérer
 * de l'espace. WhatsApp Web y stocke de quoi identifier le navigateur auprès de
 * ses serveurs. Au redémarrage, il a considéré qu'il s'agissait d'un navigateur
 * neuf, a effacé sa propre base IndexedDB (61 Mo de session) et a exigé un
 * nouvel appairage par QR code. La session était révoquée côté serveur : aucune
 * restauration locale n'a pu la récupérer.
 *
 * Seuls clearCache() (cache HTTP) et clearCodeCaches() (bytecode V8) sont sûrs.
 * clearStorageData() est proscrit ici : il touche cachestorage et indexeddb.
 */

export { CACHE_LIMIT_BYTES, shouldPurge } from './cachePolicy'

/** Taille du cache HTTP d'une session, 0 si illisible. */
async function sizeOf(ses: Electron.Session): Promise<number> {
  try {
    const size = await ses.getCacheSize()
    return Number.isFinite(size) && size > 0 ? size : 0
  } catch {
    return 0
  }
}

/**
 * Vide le cache HTTP et le code cache d'une session.
 * Retourne le nombre d'octets qui y étaient stockés.
 */
async function purgeOne(ses: Electron.Session): Promise<number> {
  const before = await sizeOf(ses)
  try {
    await ses.clearCache()
  } catch { /* session en cours d'écriture */ }
  try {
    await ses.clearCodeCaches({ urls: [] })
  } catch { /* non bloquant */ }
  return before
}

/** Total du cache HTTP de toutes les partitions fournies. */
export async function measureCaches(partitions: string[]): Promise<number> {
  const sizes = await Promise.all(
    partitions.map((part) => sizeOf(session.fromPartition(part)))
  )
  return sizes.reduce((sum, n) => sum + n, 0)
}

/** Purge toutes les partitions. Retourne les octets libérés. */
export async function purgeAll(partitions: string[]): Promise<number> {
  const freed = await Promise.all(
    partitions.map((part) => purgeOne(session.fromPartition(part)))
  )
  return freed.reduce((sum, n) => sum + n, 0)
}

/**
 * Purge au démarrage, uniquement les partitions au-dessus du plafond.
 * Retourne les octets libérés.
 */
export async function purgeOverLimit(partitions: string[]): Promise<number> {
  let freed = 0
  for (const part of partitions) {
    const ses = session.fromPartition(part)
    const size = await sizeOf(ses)
    if (shouldPurge(size)) freed += await purgeOne(ses)
  }
  return freed
}
