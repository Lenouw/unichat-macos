import { useEffect, useRef, useState } from 'react'
import { Account } from '../config/accounts'
import { parseBadgeFromTitle } from './badge'

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// Extraction du premier contact dans la liste de conversations
const SENDER_EXTRACTOR = `
(function() {
  try {
    var el =
      document.querySelector('[data-testid="cell-frame-title"]') ||
      document.querySelector('#pane-side [role="listitem"] span[title]') ||
      document.querySelector('a[href*="/t/"] span[dir="auto"]') ||
      document.querySelector('[data-tid="chat-list-item"] span') ||
      document.querySelector('.fui-ChatListItem__displayName') ||
      document.querySelector('.ListItem-button.active .info .title') ||
      document.querySelector('[class*="channelName-"]') ||
      document.querySelector('[data-qa="channel_sidebar_name_button"]');
    if (el) {
      var txt = (el.getAttribute('title') || el.textContent || '').trim();
      return txt.slice(0, 40);
    }
    return '';
  } catch(e) { return ''; }
})()
`

// Patch navigator.permissions.query pour que microphone/caméra apparaisse comme 'granted'
// Nécessaire car Electron ne relaie pas correctement l'état TCC macOS vers les webviews :
// navigator.permissions.query({ name: 'microphone' }) retourne 'prompt' au lieu de 'granted',
// ce qui fait afficher à WhatsApp "cliquez sur l'icône à côté de la barre d'adresse".
const MEDIA_PATCHER = `
(function() {
  if (window.__unichatMediaPatched) return;
  window.__unichatMediaPatched = true;

  var MEDIA_NAMES = ['microphone', 'camera', 'speaker-selection'];
  var GRANTED_RESULT = function(name) {
    return { name: name, state: 'granted', onchange: null,
      addEventListener: function() {}, removeEventListener: function() {},
      dispatchEvent: function() { return false; } };
  };

  // Patch l'instance navigator.permissions.query
  if (navigator.permissions && navigator.permissions.query) {
    var _origQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = function(desc) {
      if (desc && MEDIA_NAMES.indexOf(desc.name) !== -1) {
        return Promise.resolve(GRANTED_RESULT(desc.name));
      }
      return _origQuery(desc);
    };
  }

  // Patch aussi le prototype pour intercepter les appels via Permissions.prototype.query.call(...)
  if (window.Permissions && window.Permissions.prototype && window.Permissions.prototype.query) {
    try {
      var _origProto = window.Permissions.prototype.query;
      window.Permissions.prototype.query = function(desc) {
        if (desc && MEDIA_NAMES.indexOf(desc.name) !== -1) {
          return Promise.resolve(GRANTED_RESULT(desc.name));
        }
        return _origProto.call(this, desc);
      };
    } catch(e) {}
  }
})();
`

// Patche window.Notification pour stocker les notifs dans une queue
// lisible par le parent via executeJavaScript (postMessage ne traverse pas les webviews Electron)
const NOTIF_PATCHER = `
(function() {
  if (window.__unichatNotifPatched) return;
  window.__unichatNotifPatched = true;
  window.__unichatNotifQueue = [];
  const _Original = window.Notification;
  window.Notification = function(title, options) {
    try {
      window.__unichatNotifQueue.push({
        title: String(title).slice(0, 100),
        body: String(options && options.body ? options.body : '').slice(0, 300)
      });
    } catch(e) {}
    // Ne pas appeler _Original : le main process affiche la notif via IPC
    // pour éviter les doublons (webview + main process afficheraient chacun une notif)
    return { close: function() {} };
  };
  window.Notification.permission = 'granted';
  window.Notification.requestPermission = function() { return Promise.resolve('granted'); };
  Object.defineProperty(window.Notification, 'permission', { get: function() { return 'granted'; } });
})();
`

// Draine la queue de notifications accumulées dans la webview
// Filtre de déduplication : même titre + body pas renvoyé dans une fenêtre de 10s.
// Les entrées de plus de 60s sont purgées pour borner la mémoire.
const NOTIF_DRAIN = `
(function() {
  var queue = window.__unichatNotifQueue || [];
  var now = Date.now();
  window.__unichatNotifSent = window.__unichatNotifSent || {};
  var sent = window.__unichatNotifSent;
  for (var k in sent) {
    if (now - sent[k] > 60000) delete sent[k];
  }
  var result = [];
  for (var i = 0; i < queue.length; i++) {
    var n = queue[i];
    var key = n.title + '||' + n.body;
    var last = sent[key] || 0;
    if (now - last > 10000) {
      sent[key] = now;
      result.push(n);
    }
  }
  queue.splice(0);
  return result;
})()`

interface WebviewManagerProps {
  accounts: Account[]
  activeId: string
  onBadgeChange: (serviceId: string, count: number) => void
  onSenderChange: (serviceId: string, sender: string) => void
}

export function WebviewManager({ accounts, activeId, onBadgeChange, onSenderChange }: WebviewManagerProps) {
  // Toutes les webviews sont montées au démarrage (sinon les comptes jamais
  // visités ne produisent ni badge ni notification), mais en différé échelonné
  // pour ne pas saturer le lancement : compte actif immédiatement, puis un
  // compte supplémentaire toutes les 2 secondes.
  const [mountedIds, setMountedIds] = useState<Set<string>>(() => new Set([activeId]))

  useEffect(() => {
    setMountedIds((prev) => {
      if (prev.has(activeId)) return prev
      const next = new Set(prev)
      next.add(activeId)
      return next
    })
  }, [activeId])

  useEffect(() => {
    const pending = accounts.filter((a) => !mountedIds.has(a.id))
    if (pending.length === 0) return
    const timer = setTimeout(() => {
      setMountedIds((prev) => {
        const next = new Set(prev)
        next.add(pending[0].id)
        return next
      })
    }, 2000)
    return () => clearTimeout(timer)
  }, [accounts, mountedIds])

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      {accounts.map((account) => {
        if (!mountedIds.has(account.id)) return null

        return (
          <WebviewPane
            key={account.id}
            serviceId={account.id}
            serviceKey={account.serviceKey}
            url={account.url}
            partition={account.partition}
            visible={account.id === activeId}
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
  serviceKey: string
  url: string
  partition: string
  visible: boolean
  onBadgeChange: (serviceId: string, count: number) => void
  onSenderChange: (serviceId: string, sender: string) => void
}

type PaneStatus = 'loading' | 'ready' | 'error'

function WebviewPane({ serviceId, serviceKey, url, partition, visible, onBadgeChange, onSenderChange }: WebviewPaneProps) {
  const webviewRef = useRef<Electron.WebviewTag | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const retryCountRef = useRef(0)
  const [status, setStatus] = useState<PaneStatus>('loading')

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    let mounted = true
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }

    const startPolling = () => {
      stopPolling()

      pollRef.current = setInterval(async () => {
        if (!mounted) return

        // Badge via titre de page
        try {
          const title = webview.getTitle()
          const count = parseBadgeFromTitle(title, serviceKey)
          if (mounted) onBadgeChange(serviceId, count)
        } catch { /* webview pas prête */ }

        // Dernier contact via injection DOM
        try {
          const sender = await webview.executeJavaScript(SENDER_EXTRACTOR)
          if (mounted && typeof sender === 'string' && sender.length > 0) {
            onSenderChange(serviceId, sender)
          }
        } catch { /* silencieux */ }

        // Notifications : drainer la queue accumulée dans la webview
        try {
          const notifs = await webview.executeJavaScript(NOTIF_DRAIN)
          if (mounted && Array.isArray(notifs)) {
            for (const n of notifs) {
              if (typeof n?.title === 'string' && typeof n?.body === 'string') {
                window.unichat.notify(serviceId, n.title, n.body)
              }
            }
          }
        } catch { /* silencieux */ }
      }, 4000)
    }

    const scheduleRetry = () => {
      if (retryCountRef.current >= 3) return
      retryCountRef.current += 1
      retryTimer = setTimeout(() => {
        if (!mounted) return
        setStatus('loading')
        try { webview.reload() } catch { /* webview détruite */ }
      }, 2000 * retryCountRef.current)
    }

    const injectPatchers = () => {
      webview.executeJavaScript(MEDIA_PATCHER).catch(() => {})
      webview.executeJavaScript(NOTIF_PATCHER).catch(() => {})
    }

    const handleDomReady = () => {
      injectPatchers()
      startPolling()
      retryCountRef.current = 0
      if (mounted) setStatus('ready')
    }

    const handleDidFinishLoad = () => {
      injectPatchers()
      startPolling()
    }

    // Échec de chargement (offline, DNS…) — errorCode -3 = navigation annulée, à ignorer
    const handleDidFailLoad = (e: Electron.DidFailLoadEvent) => {
      if (e.errorCode === -3 || !e.isMainFrame) return
      stopPolling()
      if (mounted) setStatus('error')
      scheduleRetry()
    }

    // Crash du renderer de la webview (mémoire, GPU…) → reload auto avec backoff
    const handleRenderGone = () => {
      stopPolling()
      if (mounted) setStatus('error')
      scheduleRetry()
    }

    // Retour du réseau → retenter automatiquement si la pane est en erreur
    const handleOnline = () => {
      if (!mounted) return
      retryCountRef.current = 0
      setStatus((prev) => {
        if (prev === 'error') {
          try { webview.reload() } catch { /* webview détruite */ }
          return 'loading'
        }
        return prev
      })
    }

    webview.addEventListener('dom-ready', handleDomReady)
    webview.addEventListener('did-finish-load', handleDidFinishLoad)
    webview.addEventListener('did-fail-load', handleDidFailLoad as unknown as EventListener)
    webview.addEventListener('render-process-gone', handleRenderGone)
    window.addEventListener('online', handleOnline)

    return () => {
      mounted = false
      webview.removeEventListener('dom-ready', handleDomReady)
      webview.removeEventListener('did-finish-load', handleDidFinishLoad)
      webview.removeEventListener('did-fail-load', handleDidFailLoad as unknown as EventListener)
      webview.removeEventListener('render-process-gone', handleRenderGone)
      window.removeEventListener('online', handleOnline)
      if (retryTimer) clearTimeout(retryTimer)
      stopPolling()
    }
  }, [serviceId, serviceKey, onBadgeChange, onSenderChange])

  const handleManualRetry = () => {
    retryCountRef.current = 0
    setStatus('loading')
    try { webviewRef.current?.reload() } catch { /* webview détruite */ }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, display: visible ? 'block' : 'none' }}>
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
          display: 'flex',
        }}
      />
      {status === 'loading' && (
        <div style={overlayStyle}>
          <div style={spinnerStyle} />
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Chargement…</div>
        </div>
      )}
      {status === 'error' && (
        <div style={overlayStyle}>
          <div style={{ fontSize: 32 }}>📡</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
            Connexion impossible
          </div>
          <button
            onClick={handleManualRetry}
            style={{
              padding: '8px 20px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8,
              color: '#fff',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
        </div>
      )}
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: '#1a1a1a',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  zIndex: 10,
}

const spinnerStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  border: '3px solid rgba(255,255,255,0.1)',
  borderTopColor: 'rgba(255,255,255,0.6)',
  borderRadius: '50%',
  animation: 'unichat-spin 0.8s linear infinite',
}
