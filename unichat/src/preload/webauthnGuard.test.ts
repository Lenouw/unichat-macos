import { describe, it, expect } from 'vitest'
import { disableWebAuthn } from './webauthnGuard'

function fakeWindow() {
  const calls: string[] = []
  class CredentialsContainer {
    get(options?: CredentialRequestOptions & { password?: boolean }): Promise<unknown> {
      calls.push(options?.password ? 'get:password' : 'get:other')
      return Promise.resolve('credential')
    }
    create(_options?: CredentialCreationOptions): Promise<unknown> {
      calls.push('create:other')
      return Promise.resolve('credential')
    }
  }
  const w = { PublicKeyCredential: function PublicKeyCredential() {}, CredentialsContainer } as unknown as Window
  return { w, calls, credentials: new CredentialsContainer() }
}

describe('disableWebAuthn', () => {
  it('masque PublicKeyCredential, que les pages de connexion testent', () => {
    const { w } = fakeWindow()
    disableWebAuthn(w)
    expect((w as unknown as { PublicKeyCredential: unknown }).PublicKeyCredential).toBeUndefined()
  })

  it('refuse immédiatement une demande de passkey au lieu de la laisser pendre', async () => {
    const { w, credentials } = fakeWindow()
    disableWebAuthn(w)
    await expect(credentials.get({ publicKey: {} as PublicKeyCredentialRequestOptions })).rejects.toThrow('WebAuthn')
    await expect(credentials.create({ publicKey: {} as PublicKeyCredentialCreationOptions })).rejects.toThrow('WebAuthn')
  })

  it('laisse passer les autres identifiants (mots de passe enregistrés)', async () => {
    const { w, credentials, calls } = fakeWindow()
    disableWebAuthn(w)
    await expect(credentials.get({ password: true })).resolves.toBe('credential')
    expect(calls).toEqual(['get:password'])
  })
})
