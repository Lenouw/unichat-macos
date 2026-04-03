export interface ServiceType {
  key: string
  name: string
  url: string
  color: string
  description: string
  emoji: string
}

export const SERVICE_TYPES: ServiceType[] = [
  {
    key: 'whatsapp',
    name: 'WhatsApp',
    url: 'https://web.whatsapp.com',
    color: '#25D366',
    description: 'Messagerie chiffrée',
    emoji: '💬',
  },
  {
    key: 'messenger',
    name: 'Messenger',
    url: 'https://www.messenger.com',
    color: '#0099FF',
    description: 'Facebook Messenger',
    emoji: '⚡',
  },
  {
    key: 'teams',
    name: 'Teams',
    url: 'https://teams.microsoft.com',
    color: '#6264A7',
    description: 'Microsoft Teams',
    emoji: '🏢',
  },
  {
    key: 'instagram',
    name: 'Instagram',
    url: 'https://www.instagram.com/direct/inbox/',
    color: '#E1306C',
    description: 'Instagram DMs',
    emoji: '📷',
  },
  {
    key: 'telegram',
    name: 'Telegram',
    url: 'https://web.telegram.org',
    color: '#2CA5E0',
    description: 'Telegram Web',
    emoji: '✈️',
  },
  {
    key: 'slack',
    name: 'Slack',
    url: 'https://app.slack.com',
    color: '#4A154B',
    description: 'Workspace Slack',
    emoji: '#',
  },
  {
    key: 'discord',
    name: 'Discord',
    url: 'https://discord.com/app',
    color: '#5865F2',
    description: 'Discord',
    emoji: '🎮',
  },
  {
    key: 'linkedin',
    name: 'LinkedIn',
    url: 'https://www.linkedin.com/messaging/',
    color: '#0077B5',
    description: 'LinkedIn Messages',
    emoji: '💼',
  },
]
