export interface Service {
  id: string
  label: string
  url: string
  partition: string
  color: string
  userAgent?: string
}

export const SERVICES: Service[] = [
  {
    id: 'wa-perso',
    label: 'WhatsApp Perso',
    url: 'https://web.whatsapp.com',
    partition: 'persist:wa-perso',
    color: '#25D366',
  },
  {
    id: 'wa-pro1',
    label: 'WhatsApp Pro 1',
    url: 'https://web.whatsapp.com',
    partition: 'persist:wa-pro1',
    color: '#128C7E',
  },
  {
    id: 'wa-pro2',
    label: 'WhatsApp Pro 2',
    url: 'https://web.whatsapp.com',
    partition: 'persist:wa-pro2',
    color: '#075E54',
  },
  {
    id: 'messenger',
    label: 'Messenger',
    url: 'https://www.messenger.com',
    partition: 'persist:messenger',
    color: '#0099FF',
  },
  {
    id: 'teams',
    label: 'Teams',
    url: 'https://teams.microsoft.com',
    partition: 'persist:teams',
    color: '#6264A7',
  },
]
