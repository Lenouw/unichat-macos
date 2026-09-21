/** Formate une taille d'octets pour l'affichage dans l'interface. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Mo'
  const mo = bytes / (1024 * 1024)
  if (mo < 1) return '< 1 Mo'
  if (mo < 1024) return `${Math.round(mo)} Mo`
  return `${(mo / 1024).toFixed(1)} Go`
}
