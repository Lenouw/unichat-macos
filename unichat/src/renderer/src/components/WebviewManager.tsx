import { useEffect, useRef } from 'react'
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

// Intercepte les clics sur les liens externes et window.open via une queue
// (new-window et will-navigate ne sont plus fiables en Electron 28+)
const LINK_PATCHER = `
(function() {
  if (window.__unichatLinkPatched) return;
  window.__unichatLinkPatched = true;
  window.__unichatLinkQueue = [];

  // Intercepte window.open (liens target="_blank", partages, etc.)
  var _origOpen = window.open;
  window.open = function(url) {
    if (url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
      window.__unichatLinkQueue.push(url);
      return null;
    }
    return _origOpen.apply(this, arguments);
  };

  // Intercepte les clics sur les <a> qui mènent vers l'extérieur
  document.addEventListener('click', function(e) {
    var target = e.target;
    while (target && target.tagName !== 'A') target = target.parentElement;
    if (!target) return;
    var href = target.href || target.getAttribute('href');
    if (!href) return;
    try {
      var url = new URL(href, location.href);
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        if (url.hostname !== location.hostname) {
          e.preventDefault();
          e.stopPropagation();
          window.__unichatLinkQueue.push(url.href);
        }
      }
    } catch(err) {}
  }, true);
})();
`

const LINK_DRAIN = `(window.__unichatLinkQueue || []).splice(0)`

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
    return new _Original(title, options);
  };
  window.Notification.permission = 'granted';
  window.Notification.requestPermission = function() { return Promise.resolve('granted'); };
  Object.defineProperty(window.Notification, 'permission', { get: function() { return 'granted'; } });
})();
`

// Draine la queue de notifications accumulées dans la webview
// Inclut un filtre de déduplication côté webview : on n'envoie pas deux fois
// la même notif (même titre + body) dans une fenêtre de 10s
const NOTIF_DRAIN = `
(function() {
  var queue = window.__unichatNotifQueue || [];
  var now = Date.now();
  window.__unichatNotifSent = window.__unichatNotifSent || {};
  var result = [];
  for (var i = 0; i < queue.length; i++) {
    var n = queue[i];
    var key = n.title + '||' + n.body;
    var last = window.__unichatNotifSent[key] || 0;
    if (now - last > 10000) {
      window.__unichatNotifSent[key] = now;
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
  const loadedRef = useRef<Set<string>>(new Set([activeId]))

  useEffect(() => {
    loadedRef.current.add(activeId)
  }, [activeId])

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      {accounts.map((account) => {
        const shouldRender = loadedRef.current.has(account.id)
        const isActive = account.id === activeId

        if (!shouldRender) return null

        return (
          <WebviewPane
            key={account.id}
            serviceId={account.id}
            url={account.url}
            partition={account.partition}
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

    const startPolling = () => {
      if (pollRef.current) clearInterval(pollRef.current)

      pollRef.current = setInterval(async () => {
        // Badge via titre de page
        try {
          const title = webview.getTitle()
          const count = parseBadgeFromTitle(title)
          onBadgeChange(serviceId, count)
        } catch { /* webview pas prête */ }

        // Dernier contact via injection DOM
        try {
          const sender = await webview.executeJavaScript(SENDER_EXTRACTOR)
          if (typeof sender === 'string' && sender.length > 0) {
            onSenderChange(serviceId, sender)
          }
        } catch { /* silencieux */ }

        // Liens externes : drainer la queue et ouvrir dans le navigateur système
        try {
          const links = await webview.executeJavaScript(LINK_DRAIN)
          if (Array.isArray(links)) {
            for (const url of links) {
              if (typeof url === 'string') window.unichat.openExternal(url)
            }
          }
        } catch { /* silencieux */ }

        // Notifications : drainer la queue accumulée dans la webview
        // (postMessage webview→parent ne fonctionne pas dans Electron)
        try {
          const notifs = await webview.executeJavaScript(NOTIF_DRAIN)
          if (Array.isArray(notifs)) {
            for (const n of notifs) {
              if (typeof n?.title === 'string' && typeof n?.body === 'string') {
                window.unichat.notify(serviceId, n.title, n.body)
              }
            }
          }
        } catch { /* silencieux */ }
      }, 4000)
    }

    const injectPatchers = () => {
      webview.executeJavaScript(LINK_PATCHER).catch(() => {})
      webview.executeJavaScript(NOTIF_PATCHER).catch(() => {})
    }

    const handleDomReady = () => {
      injectPatchers()
    }

    const handleDidFinishLoad = () => {
      injectPatchers()
      startPolling()
    }

    webview.addEventListener('dom-ready', handleDomReady)
    webview.addEventListener('did-finish-load', handleDidFinishLoad)

    return () => {
      webview.removeEventListener('dom-ready', handleDomReady)
      webview.removeEventListener('did-finish-load', handleDidFinishLoad)
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
