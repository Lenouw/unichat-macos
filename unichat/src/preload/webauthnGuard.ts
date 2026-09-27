// Désactive WebAuthn (passkeys, Touch ID, clés de sécurité) dans une page.
//
// Electron n'implémente pas la fenêtre système que Chrome ou Safari affichent pour
// une passkey : la demande part et rien n'apparaît. Microsoft propose la passkey
// dès que le compte en a une (incident 2026-09-27 : connexion Teams bloquée sur
// « Visage, empreinte digitale, code PIN ou clé de sécurité », sans fenêtre).
// Sans WebAuthn, les pages de connexion se rabattent sur la notification
// Authenticator ou le mot de passe, qui passent par des pages web ordinaires.
//
// La fonction est sérialisée par contextBridge.executeInMainWorld : elle ne doit
// rien référencer hors de son corps.
export function disableWebAuthn(w: Window = window): void {
  const unsupported = (): Promise<never> =>
    Promise.reject(new DOMException('WebAuthn indisponible dans UniChat', 'NotSupportedError'))

  // Détection habituelle : `window.PublicKeyCredential` absent = pas de passkey
  try {
    Object.defineProperty(w, 'PublicKeyCredential', { value: undefined, configurable: true, writable: true })
  } catch {
    /* propriété verrouillée : on compte sur le filet ci-dessous */
  }

  // Filet : une page qui appelle quand même navigator.credentials avec publicKey
  // reçoit un refus immédiat au lieu d'une attente sans fin
  const container = (w as Window & { CredentialsContainer?: { prototype: CredentialsContainer } }).CredentialsContainer
  const proto = container?.prototype
  if (!proto) return
  const originalGet = proto.get
  const originalCreate = proto.create
  proto.get = function (options?: CredentialRequestOptions) {
    return options?.publicKey ? unsupported() : originalGet.call(this, options)
  }
  proto.create = function (options?: CredentialCreationOptions) {
    return options?.publicKey ? unsupported() : originalCreate.call(this, options)
  }
}
