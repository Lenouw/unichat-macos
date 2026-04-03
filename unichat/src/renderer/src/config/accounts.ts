import { SERVICE_TYPES } from './serviceTypes'

export interface Account {
  id: string
  serviceKey: string
  label: string
  color: string
  url: string
  partition: string
}

const ACCOUNTS_KEY = 'unichat:accounts'

// Partition ID autorisé : 'persist:' suivi de caractères alphanumériques, tirets, underscores
const SAFE_PARTITION_RE = /^persist:[a-zA-Z0-9_-]{1,128}$/

// ID de compte autorisé : alphanumérique + tirets uniquement
const SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/

// Comptes par défaut — on réutilise les partition IDs existants pour
// préserver les sessions déjà scannées (QR codes WhatsApp, etc.)
const DEFAULT_ACCOUNTS: Account[] = [
  {
    id: 'wa-perso',
    serviceKey: 'whatsapp',
    label: 'WhatsApp Perso',
    color: '#25D366',
    url: 'https://web.whatsapp.com',
    partition: 'persist:wa-perso',
  },
  {
    id: 'wa-pro1',
    serviceKey: 'whatsapp',
    label: 'WhatsApp Pro 1',
    color: '#128C7E',
    url: 'https://web.whatsapp.com',
    partition: 'persist:wa-pro1',
  },
  {
    id: 'wa-pro2',
    serviceKey: 'whatsapp',
    label: 'WhatsApp Pro 2',
    color: '#075E54',
    url: 'https://web.whatsapp.com',
    partition: 'persist:wa-pro2',
  },
  {
    id: 'messenger',
    serviceKey: 'messenger',
    label: 'Messenger',
    color: '#0099FF',
    url: 'https://www.messenger.com',
    partition: 'persist:messenger',
  },
  {
    id: 'teams',
    serviceKey: 'teams',
    label: 'Teams',
    color: '#6264A7',
    url: 'https://teams.microsoft.com',
    partition: 'persist:teams',
  },
]

// Valide un compte chargé depuis localStorage
// Rejet strict : tout champ malformé → compte ignoré
function isValidAccount(acc: unknown): acc is Account {
  if (typeof acc !== 'object' || acc === null) return false
  const a = acc as Record<string, unknown>

  if (typeof a.id !== 'string' || !SAFE_ID_RE.test(a.id)) return false
  if (typeof a.serviceKey !== 'string' || a.serviceKey.length === 0) return false
  if (typeof a.label !== 'string' || a.label.length === 0 || a.label.length > 100) return false
  if (typeof a.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(a.color)) return false
  if (typeof a.url !== 'string') return false
  if (typeof a.partition !== 'string' || !SAFE_PARTITION_RE.test(a.partition)) return false

  // L'URL doit correspondre à un service connu (pas d'injection d'URL arbitraire)
  const knownUrls = SERVICE_TYPES.map((s) => s.url)
  if (!knownUrls.some((knownUrl) => a.url === knownUrl)) return false

  return true
}

export function loadAccounts(): Account[] {
  try {
    const stored = localStorage.getItem(ACCOUNTS_KEY)
    if (!stored) return DEFAULT_ACCOUNTS

    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) return DEFAULT_ACCOUNTS

    const valid = parsed.filter(isValidAccount)
    return valid.length > 0 ? valid : DEFAULT_ACCOUNTS
  } catch {
    return DEFAULT_ACCOUNTS
  }
}

export function saveAccounts(accounts: Account[]): void {
  // On ne sauvegarde que les comptes valides — filet de sécurité
  const safe = accounts.filter(isValidAccount)
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(safe))
}

export function createAccount(serviceKey: string, label: string, color: string): Account {
  const serviceType = SERVICE_TYPES.find((s) => s.key === serviceKey)
  if (!serviceType) throw new Error(`Service inconnu : ${serviceKey}`)

  const id = crypto.randomUUID()

  return {
    id,
    serviceKey,
    label: label.trim().slice(0, 100),
    color,
    url: serviceType.url, // URL toujours issue du catalogue — jamais de l'input utilisateur
    partition: `persist:account-${id}`,
  }
}
