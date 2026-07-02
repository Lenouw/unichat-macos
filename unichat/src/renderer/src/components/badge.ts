// Extraction du nombre de non-lus depuis le titre de la page.
// Ancré au début du titre : WhatsApp, Messenger, Telegram, Discord et Teams
// préfixent tous "(n) …". Une regex non ancrée matcherait des parenthèses
// au milieu du titre (ex. Teams : "Réunion (3 participants)") → badge fantôme.
export function parseBadgeFromTitle(title: string, serviceKey?: string): number {
  // Slack ne met jamais de count dans le titre : il préfixe "*" ou "!"
  // quand il y a des non-lus → badge indéterminé, on affiche 1
  if (serviceKey === 'slack') {
    return /^[*!]/.test(title.trim()) ? 1 : 0
  }

  const match = title.match(/^\((\d+)\+?\)/)
  return match ? parseInt(match[1], 10) : 0
}
