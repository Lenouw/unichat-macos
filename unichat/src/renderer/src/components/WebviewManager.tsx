import { useEffect, useRef } from 'react'
import { SERVICES } from '../config/services'
import { parseBadgeFromTitle } from './badge'

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// Injection JS pour extraire le nom du premier contact dans la liste de conversations
// Fonctionne pour WhatsApp Web, Messenger et Teams via des sélecteurs différents
const SENDER_EXTRACTOR = `
(function() {
  try {
    var el =
      document.querySelector('[data-testid="cell-frame-title"]') ||
      document.querySelector('a[href*="/t/"] span[dir="auto"]') ||
      document.querySelector('[data-tid="chat-list-item"] span') ||
      document.querySelector('.fui-ChatListItem__displayName');
    if (el) {
      var txt = (el.getAttribute('title') || el.textContent || '').trim();
      return txt.slice(0, 40);
    }
    return '';
  } catch(e) { return ''; }
})()
`

interface WebviewManagerProps {
  activeId: string
  onBadgeChange: (serviceId: string, count: number) => void
  onSenderChange: (serviceId: string, sender: string) => void
}

export function WebviewManager({ activeId, onBadgeChange, onSenderChange }: WebviewManagerProps) {
  const loadedRef = useRef<Set<string>>(new Set([activeId]))

  useEffect(() => {
    loadedRef.current.add(activeId)
  }, [activeId])

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      {SERVICES.map((service) => {
        const shouldRender = loadedRef.current.has(service.id)
        const isActive = service.id === activeId

        if (!shouldRender) return null

        return (
          <WebviewPane
            key={service.id}
            serviceId={service.id}
            url={service.url}
            partition={service.partition}
            visible={isActive}
            onBadgeChange={onBadgeChange}
            onSenderChange={onSenderChange}
          />
        )
      })}
    </div>
  )
}

interface WebviewPaneProps {
  serviceId: string
  url: string
  partition: string
  visible: boolean
  onBadgeChange: (serviceId: string, count: number) => void
  onSenderChange: (serviceId: string, sender: string) => void
}

function WebviewPane({ serviceId, url, partition, visible, onBadgeChange, onSenderChange }: WebviewPaneProps) {
  const webviewRef = useRef<Electron.WebviewTag | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    const handleDidFinishLoad = () => {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(async () => {
        // Badge via titre de page
        const title = webview.getTitle()
        const count = parseBadgeFromTitle(title)
        onBadgeChange(serviceId, count)

        // Dernier contact via injection DOM (toutes les 4s pour ne pas surcharger)
        try {
          const sender = await webview.executeJavaScript(SENDER_EXTRACTOR)
          if (typeof sender === 'string' && sender.length > 0) {
            onSenderChange(serviceId, sender)
          }
        } catch {
          // Silencieux — la webview n'est peut-être pas encore prête
        }
      }, 4000)
    }

    const handleDomReady = () => {
      webview.executeJavaScript(`
        (function() {
          if (window.__unichatNotifPatched) return;
          window.__unichatNotifPatched = true;
          const _Original = window.Notification;
          window.Notification = function(title, options) {
            try {
              window.postMessage({ __unichat: true, title, body: options?.body ?? '' }, '*');
            } catch(e) {}
            return new _Original(title, options);
          };
          window.Notification.permission = 'granted';
          window.Notification.requestPermission = () => Promise.resolve('granted');
        })();
      `)
    }

    const handleMessage = (event: MessageEvent) => {
      if (
        event.data?.__unichat === true &&
        typeof event.data.title === 'string' &&
        typeof event.data.body === 'string'
      ) {
        window.unichat.notify(serviceId, event.data.title, event.data.body)
      }
    }

    webview.addEventListener('did-finish-load', handleDidFinishLoad)
    webview.addEventListener('dom-ready', handleDomReady)
    window.addEventListener('message', handleMessage)

    return () => {
      webview.removeEventListener('did-finish-load', handleDidFinishLoad)
      webview.removeEventListener('dom-ready', handleDomReady)
      window.removeEventListener('message', handleMessage)
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [serviceId, onBadgeChange, onSenderChange])

  return (
    <webview
      ref={webviewRef}
      src={url}
      partition={partition}
      useragent={CHROME_UA}
      allowpopups={true}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: visible ? 'flex' : 'none',
      }}
    />
  )
}
