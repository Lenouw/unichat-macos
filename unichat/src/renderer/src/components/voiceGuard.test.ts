// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { VOICE_GUARD } from './WebviewManager'

/**
 * Le garde-fou est injecté dans les webviews sous forme de string.
 * On l'évalue ici dans jsdom pour reproduire le scénario réel :
 * enregistrement vocal en cours + appui sur Entrée.
 */

interface FakeTrack {
  kind: string
  stop: () => void
  addEventListener: (event: string, cb: () => void) => void
}

function makeAudioStream(): { stream: unknown; track: FakeTrack } {
  const track: FakeTrack = {
    kind: 'audio',
    stop: () => {},
    addEventListener: () => {},
  }
  return { stream: { getAudioTracks: () => [track] }, track }
}

/**
 * Installe un faux getUserMedia puis évalue le garde-fou sur ce document.
 *
 * En production le garde-fou s'installe une seule fois par page (flag
 * __unichatVoiceGuarded). Ici on le réinstalle à chaque test, donc on capture
 * l'écouteur posé pour pouvoir le retirer ensuite : sans ça, les écouteurs des
 * tests précédents resteraient actifs avec leur état "enregistrement en cours".
 */
function installGuard(): { startRecording: () => Promise<FakeTrack>; cleanup: () => void } {
  let pending: ReturnType<typeof makeAudioStream> | null = null

  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: () => {
        pending = makeAudioStream()
        return Promise.resolve(pending.stream)
      },
    },
  })

  const installed: Array<Parameters<typeof window.addEventListener>> = []
  const originalAdd = window.addEventListener.bind(window)
  window.addEventListener = ((...args: Parameters<typeof window.addEventListener>) => {
    installed.push(args)
    return originalAdd(...args)
  }) as typeof window.addEventListener

  // eslint-disable-next-line no-eval
  ;(0, eval)(VOICE_GUARD)

  window.addEventListener = originalAdd

  return {
    async startRecording() {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      return pending!.track
    },
    cleanup() {
      installed.forEach(([type, listener, options]) =>
        window.removeEventListener(type, listener as EventListener, options as boolean)
      )
    },
  }
}

/** Crée un élément visible (jsdom ne calcule pas offsetParent). */
function appendVisible(tag: string, attrs: Record<string, string> = {}, text = ''): HTMLElement {
  const el = document.createElement(tag)
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
  if (text) el.textContent = text
  document.body.appendChild(el)
  Object.defineProperty(el, 'offsetParent', { value: document.body, configurable: true })
  return el
}

function pressEnter(): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
  })
  document.body.dispatchEvent(event)
  return event
}

describe('VOICE_GUARD — protection des messages vocaux', () => {
  let guards: Array<{ cleanup: () => void }> = []

  const install = (): ReturnType<typeof installGuard> => {
    const guard = installGuard()
    guards.push(guard)
    return guard
  }

  beforeEach(() => {
    document.body.replaceChildren()
    // @ts-expect-error — reset du flag d'idempotence entre les tests
    delete window.__unichatVoiceGuarded
  })

  afterEach(() => {
    guards.forEach((g) => g.cleanup())
    guards = []
  })

  it("clique sur Envoyer au lieu de détruire l'enregistrement", async () => {
    const onSend = vi.fn()
    appendVisible('button', { 'data-icon': 'send' }).addEventListener('click', onSend)

    const guard = install()
    await guard.startRecording()

    const event = pressEnter()

    expect(event.defaultPrevented).toBe(true)
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it("bloque Entrée même si le bouton Envoyer est introuvable (l'enregistrement survit)", async () => {
    const guard = install()
    await guard.startRecording()

    const event = pressEnter()

    // Rien n'est envoyé, mais surtout : rien n'est détruit
    expect(event.defaultPrevented).toBe(true)
  })

  it("laisse passer Entrée quand aucun enregistrement n'est en cours", () => {
    install()

    const event = pressEnter()

    expect(event.defaultPrevented).toBe(false)
  })

  it('laisse passer Entrée pendant un appel si du texte est saisi', async () => {
    appendVisible('div', { contenteditable: 'true' }, 'bonjour')

    const guard = install()
    await guard.startRecording()

    const event = pressEnter()

    expect(event.defaultPrevented).toBe(false)
  })

  it("cesse de bloquer Entrée une fois l'enregistrement terminé", async () => {
    const guard = install()
    const track = await guard.startRecording()

    expect(pressEnter().defaultPrevented).toBe(true)

    track.stop()

    expect(pressEnter().defaultPrevented).toBe(false)
  })
})
