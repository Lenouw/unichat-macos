/**
 * Décide où s'ouvre une fenêtre demandée par une webview. Sans dépendance à
 * Electron pour rester testable.
 *
 * - Popup ouverte par script avec dimensions ('new-window') ou about:blank :
 *   c'est la forme des popups de connexion (MSAL, Authenticator, SSO
 *   d'entreprise). Elle s'ouvre dans l'app, avec la session du compte.
 * - Tout le reste (liens target=_blank) : navigateur système.
 */
export type PopupTarget = 'app' | 'browser'

export function classifyPopup(url: string, disposition: string): PopupTarget {
  if (url === 'about:blank') return 'app'
  if (disposition === 'new-window' && url.startsWith('https://')) return 'app'
  return 'browser'
}
