import { useEffect, useRef } from 'react'
import { SERVICES } from '../config/services'
import { parseBadgeFromTitle } from './badge'

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

interface WebviewManagerProps {
  activeId: string
  onBadgeChange: (serviceId: string, count: number) => void
}

export function WebviewManager({ activeId, onBadgeChange }: WebviewManagerProps) {
  const loadedRef = useRef<Set<string>>(new Set([activeId]))

  useEffect(() => {
    loadedRef.current.add(activeId)
  }, [activeId])

  return (
    <div className="flex-1 relative">
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
}

function WebviewPane({ serviceId, url, partition, visible, onBadgeChange }: WebviewPaneProps) {
  const webviewRef = useRef<Electron.WebviewTag | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    const handleDidFinishLoad = () => {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(() => {
        const title = webview.getTitle()
        const count = parseBadgeFromTitle(title)
        onBadgeChange(serviceId, count)
      }, 2000)
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
      if (event.data?.__unichat) {
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
  }, [serviceId, onBadgeChange])

  return (
    <webview
      ref={webviewRef}
      src={url}
      partition={partition}
      useragent={CHROME_UA}
      // @ts-expect-error — attribut Electron non standard non typé
      disablewebsecurity="true"
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
