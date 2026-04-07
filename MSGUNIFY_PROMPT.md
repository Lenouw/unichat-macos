# Prompt — Construire MsgUnify avec Claude Code

Copie ce prompt dans Claude Code pour construire l'application de zéro.

---

Tu es chargé de construire de zéro une application desktop macOS appelée **MsgUnify** — un agrégateur de messageries qui centralise WhatsApp, Messenger, Teams, Instagram, Telegram, Slack, Discord et LinkedIn dans des webviews isolées.

## Stack technique

- **Electron-vite** (template officiel electron/react-ts via `npm create @quick-start/electron`)
- **React 18+** + **TypeScript**
- **Tailwind CSS v4** (plugin Vite)
- **electron-builder** pour le packaging
- **electron-updater** pour les mises à jour automatiques
- **Vitest** + **jsdom** pour les tests

---

## Architecture globale

```
src/
  main/index.ts          → Process Electron (IPC, permissions, auto-update, shortcuts)
  preload/index.ts       → Bridge contextBridge (API window.msgunify)
  preload/index.d.ts     → Types TypeScript du bridge
  renderer/src/
    App.tsx              → État global (comptes, badges, update status)
    components/
      Sidebar.tsx        → Liste comptes, update banner, version
      WebviewManager.tsx → Webviews isolées + polling + injection JS
      AddAccountModal.tsx→ Modal ajout compte
      badge.ts           → Parsing badge depuis le titre de page
    config/
      accounts.ts        → CRUD localStorage + validation stricte
      serviceTypes.ts    → Catalogue des 8 services
      version.ts         → APP_VERSION avec fallback test
```

---

## Fichier 1 — `src/main/index.ts`

Points critiques à implémenter :

1. **userData fixe** : avant tout, forcer le chemin userData pour que dev et prod partagent les mêmes sessions :
   ```ts
   app.setPath('userData', join(app.getPath('home'), 'Library', 'Application Support', 'MsgUnify'))
   ```

2. **Single instance lock** :
   ```ts
   if (!app.requestSingleInstanceLock()) {
     app.quit()
   } else {
     app.on('second-instance', () => {
       if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus() }
     })
   }
   ```

3. **Permission micro macOS** — OBLIGATOIRE sinon le flux audio est silencieux sans erreur :
   ```ts
   app.whenReady().then(async () => {
     if (process.platform === 'darwin') {
       await systemPreferences.askForMediaAccess('microphone')
     }
     // ...
   })
   ```

4. **Permissions sessions** — `session-created` ne fire PAS pour les sessions déjà sur disque. Appel explicite obligatoire :
   ```ts
   function setupMediaPermissions(): void {
     const allowedPermissions = new Set(['media', 'microphone', 'audioCapture', 'notifications', 'clipboard-read'])
     const applyToSession = (ses: Electron.Session): void => {
       ses.setPermissionRequestHandler((_wc, permission, callback) => { callback(allowedPermissions.has(permission)) })
       ses.setPermissionCheckHandler((_wc, permission) => allowedPermissions.has(permission))
     }
     // Appliquer aux sessions connues (déjà sur disque)
     const knownPartitions = ['wa-perso', 'wa-pro1', 'wa-pro2', 'messenger', 'teams']
     knownPartitions.forEach((id) => applyToSession(session.fromPartition(`persist:${id}`)))
     // Attraper les nouvelles sessions dynamiques
     app.on('session-created', applyToSession)
   }
   ```

5. **IPC handlers** :
   - `badge:update` → valider payload, mettre à jour `app.dock?.setBadge()`
   - `notification:show` → `new Notification({ title, body }).show()`
   - `accounts:register` → `globalShortcut.register('CommandOrControl+N', ...)` pour Cmd+1 à Cmd+9
   - `update:install` → `autoUpdater.quitAndInstall()`
   - `open:external` → valider URL (https seulement) puis `shell.openExternal(url)`

6. **BrowserWindow** :
   ```ts
   new BrowserWindow({
     width: 1200, height: 800, minWidth: 800, minHeight: 600,
     titleBarStyle: 'hiddenInset',
     backgroundColor: '#1a1a1a',
     show: false,
     webPreferences: {
       preload: join(__dirname, '../preload/index.js'),
       sandbox: false,        // obligatoire pour les webviews multi-partition
       contextIsolation: true,
       nodeIntegration: false,
       webviewTag: true,      // obligatoire
     },
   })
   ```

7. **Auto-updater** (prod uniquement) :
   ```ts
   if (!is.dev) {
     autoUpdater.autoDownload = true
     autoUpdater.autoInstallOnAppQuit = true
     autoUpdater.on('update-available', (info) => mainWindow?.webContents.send('update:available', info.version))
     autoUpdater.on('download-progress', (p) => mainWindow?.webContents.send('update:progress', Math.round(p.percent)))
     autoUpdater.on('update-downloaded', (info) => mainWindow?.webContents.send('update:ready', info.version))
     setTimeout(() => autoUpdater.checkForUpdates(), 3000)
     setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000)
   }
   ```

8. **Sécurité** : regex de validation IDs :
   ```ts
   const SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/
   ```

---

## Fichier 2 — `src/preload/index.ts`

```ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('msgunify', {
  setBadge: (serviceId: string, count: number) =>
    ipcRenderer.send('badge:update', { serviceId, count }),

  notify: (serviceId: string, title: string, body: string) => {
    ipcRenderer.send('notification:show', {
      serviceId,
      title: String(title).slice(0, 100),
      body: String(body).slice(0, 300)
    })
  },

  onServiceSelect: (callback: (id: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, id: string) => callback(id)
    ipcRenderer.on('service:select', listener)
    return () => ipcRenderer.removeListener('service:select', listener)
  },

  registerAccounts: (ids: string[]) => ipcRenderer.send('accounts:register', ids),

  onUpdateStatus: (callback: (event: string, payload?: string) => void) => {
    const handlers: Array<[string, (...args: unknown[]) => void]> = [
      ['update:checking',      () => callback('checking')],
      ['update:available',     (_e: unknown, v: unknown) => callback('available', String(v))],
      ['update:not-available', () => callback('not-available')],
      ['update:progress',      (_e: unknown, p: unknown) => callback('progress', String(p))],
      ['update:ready',         (_e: unknown, v: unknown) => callback('ready', String(v))],
    ]
    handlers.forEach(([ch, fn]) => ipcRenderer.on(ch, fn))
    return () => handlers.forEach(([ch, fn]) => ipcRenderer.removeListener(ch, fn))
  },

  installUpdate: () => ipcRenderer.send('update:install'),

  openExternal: (url: string) => ipcRenderer.send('open:external', url),
})
```

---

## Fichier 3 — `src/preload/index.d.ts`

```ts
declare global {
  interface Window {
    msgunify: {
      setBadge: (serviceId: string, count: number) => void
      notify: (serviceId: string, title: string, body: string) => void
      onServiceSelect: (callback: (id: string) => void) => () => void
      registerAccounts: (ids: string[]) => void
      onUpdateStatus: (callback: (event: string, payload?: string) => void) => () => void
      installUpdate: () => void
      openExternal: (url: string) => void
    }
  }
}
```

---

## Fichier 4 — `src/renderer/src/config/serviceTypes.ts`

```ts
export interface ServiceType {
  key: string
  name: string
  url: string
  color: string
  description: string
  emoji: string
}

export const SERVICE_TYPES: ServiceType[] = [
  { key: 'whatsapp',  name: 'WhatsApp',  url: 'https://web.whatsapp.com',                   color: '#25D366', emoji: '💬', description: 'Messagerie WhatsApp' },
  { key: 'messenger', name: 'Messenger', url: 'https://www.messenger.com',                   color: '#0099FF', emoji: '⚡', description: 'Facebook Messenger' },
  { key: 'teams',     name: 'Teams',     url: 'https://teams.microsoft.com',                 color: '#6264A7', emoji: '🏢', description: 'Microsoft Teams' },
  { key: 'instagram', name: 'Instagram', url: 'https://www.instagram.com/direct/inbox/',     color: '#E1306C', emoji: '📷', description: 'Instagram DMs' },
  { key: 'telegram',  name: 'Telegram',  url: 'https://web.telegram.org',                    color: '#2CA5E0', emoji: '✈️', description: 'Telegram' },
  { key: 'slack',     name: 'Slack',     url: 'https://app.slack.com',                       color: '#4A154B', emoji: '#',  description: 'Slack' },
  { key: 'discord',   name: 'Discord',   url: 'https://discord.com/app',                     color: '#5865F2', emoji: '🎮', description: 'Discord' },
  { key: 'linkedin',  name: 'LinkedIn',  url: 'https://www.linkedin.com/messaging/',          color: '#0077B5', emoji: '💼', description: 'LinkedIn Messaging' },
]
```

---

## Fichier 5 — `src/renderer/src/config/accounts.ts`

```ts
import { SERVICE_TYPES } from './serviceTypes'

const ACCOUNT_LABEL_MAX = 100
const SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/
const SAFE_PARTITION_RE = /^persist:[a-zA-Z0-9_-]{1,128}$/
const SAFE_COLOR_RE = /^#[0-9a-fA-F]{6}$/
const ALLOWED_URLS = new Set(SERVICE_TYPES.map((s) => s.url))

export interface Account {
  id: string
  serviceKey: string
  label: string
  color: string
  url: string
  partition: string
}

const STORAGE_KEY = 'msgunify:accounts'

function getDefaultAccounts(): Account[] {
  const wa = SERVICE_TYPES.find(s => s.key === 'whatsapp')!
  const me = SERVICE_TYPES.find(s => s.key === 'messenger')!
  const te = SERVICE_TYPES.find(s => s.key === 'teams')!
  return [
    { id: 'wa-perso',  serviceKey: 'whatsapp',  label: 'WhatsApp Perso', color: wa.color, url: wa.url, partition: 'persist:wa-perso'  },
    { id: 'wa-pro1',   serviceKey: 'whatsapp',  label: 'WhatsApp Pro 1', color: wa.color, url: wa.url, partition: 'persist:wa-pro1'   },
    { id: 'messenger', serviceKey: 'messenger', label: 'Messenger',      color: me.color, url: me.url, partition: 'persist:messenger' },
    { id: 'teams',     serviceKey: 'teams',     label: 'Teams',          color: te.color, url: te.url, partition: 'persist:teams'     },
  ]
}

function isValidAccount(a: unknown): a is Account {
  if (typeof a !== 'object' || a === null) return false
  const { id, serviceKey, label, color, url, partition } = a as Record<string, unknown>
  if (typeof id !== 'string' || !SAFE_ID_RE.test(id)) return false
  if (typeof serviceKey !== 'string') return false
  if (typeof label !== 'string' || label.length === 0 || label.length > ACCOUNT_LABEL_MAX) return false
  if (typeof color !== 'string' || !SAFE_COLOR_RE.test(color)) return false
  if (typeof url !== 'string' || !ALLOWED_URLS.has(url)) return false
  if (typeof partition !== 'string' || !SAFE_PARTITION_RE.test(partition)) return false
  return true
}

export function loadAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return getDefaultAccounts()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return getDefaultAccounts()
    const valid = parsed.filter(isValidAccount)
    return valid.length > 0 ? valid : getDefaultAccounts()
  } catch {
    return getDefaultAccounts()
  }
}

export function saveAccounts(accounts: Account[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts))
}

export function createAccount(serviceKey: string, label: string, color: string): Account | null {
  const service = SERVICE_TYPES.find(s => s.key === serviceKey)
  if (!service) return null
  const id = crypto.randomUUID()
  const partition = `persist:account-${id}`
  return {
    id,
    serviceKey,
    label: label.slice(0, ACCOUNT_LABEL_MAX),
    color,
    url: service.url,
    partition,
  }
}
```

---

## Fichier 6 — `src/renderer/src/components/WebviewManager.tsx`

**Décisions d'architecture CRITIQUES** :

### window.postMessage ne fonctionne PAS depuis une webview Electron vers le parent renderer.
Solution : injecter des queues JS dans la webview et les drainer via `executeJavaScript` toutes les 4s.

### Les événements `new-window` et `will-navigate` ne sont plus fiables en Electron 28+.
Solution : intercepter window.open et les clics sur `<a>` avec du JS injecté.

```tsx
const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// Extraction du dernier contact dans la liste de conversations
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
    if (el) return (el.getAttribute('title') || el.textContent || '').trim().slice(0, 40);
    return '';
  } catch(e) { return ''; }
})()
`

// Intercepte window.open + clics <a> vers l'extérieur
const LINK_PATCHER = `
(function() {
  if (window.__msgunifyLinkPatched) return;
  window.__msgunifyLinkPatched = true;
  window.__msgunifyLinkQueue = [];
  var _origOpen = window.open;
  window.open = function(url) {
    if (url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
      window.__msgunifyLinkQueue.push(url); return null;
    }
    return _origOpen.apply(this, arguments);
  };
  document.addEventListener('click', function(e) {
    var target = e.target;
    while (target && target.tagName !== 'A') target = target.parentElement;
    if (!target) return;
    var href = target.href || target.getAttribute('href');
    if (!href) return;
    try {
      var url = new URL(href, location.href);
      if ((url.protocol === 'https:' || url.protocol === 'http:') && url.hostname !== location.hostname) {
        e.preventDefault(); e.stopPropagation();
        window.__msgunifyLinkQueue.push(url.href);
      }
    } catch(err) {}
  }, true);
})();
`
const LINK_DRAIN = `(window.__msgunifyLinkQueue || []).splice(0)`

// Intercepte window.Notification → queue
const NOTIF_PATCHER = `
(function() {
  if (window.__msgunifyNotifPatched) return;
  window.__msgunifyNotifPatched = true;
  window.__msgunifyNotifQueue = [];
  const _Original = window.Notification;
  window.Notification = function(title, options) {
    try {
      window.__msgunifyNotifQueue.push({
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

// Drain avec dedup 10s
const NOTIF_DRAIN = `
(function() {
  var queue = window.__msgunifyNotifQueue || [];
  var now = Date.now();
  window.__msgunifyNotifSent = window.__msgunifyNotifSent || {};
  var result = [];
  for (var i = 0; i < queue.length; i++) {
    var n = queue[i]; var key = n.title + '||' + n.body;
    if (now - (window.__msgunifyNotifSent[key] || 0) > 10000) {
      window.__msgunifyNotifSent[key] = now; result.push(n);
    }
  }
  queue.splice(0); return result;
})()`
```

**Polling toutes les 4s** par webview :
1. `webview.getTitle()` → `parseBadgeFromTitle()` → `onBadgeChange`
2. `executeJavaScript(SENDER_EXTRACTOR)` → `onSenderChange`
3. `executeJavaScript(LINK_DRAIN)` → `window.msgunify.openExternal(url)` pour chaque lien
4. `executeJavaScript(NOTIF_DRAIN)` → `window.msgunify.notify(serviceId, title, body)` pour chaque notif

**Lazy-loading** : ne créer la webview qu'au premier clic sur un compte.

**La webview** :
```tsx
<webview
  src={url}
  partition={partition}
  useragent={CHROME_UA}
  allowpopups={true}
  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: visible ? 'flex' : 'none' }}
/>
```

---

## Fichier 7 — `src/renderer/src/components/badge.ts`

```ts
export function parseBadgeFromTitle(title: string): number {
  const match = title.match(/\((\d+)\)/)
  return match ? parseInt(match[1], 10) : 0
}
```

---

## Fichier 8 — `src/renderer/src/config/version.ts`

```ts
// __APP_VERSION__ est injecté par Vite via define. Fallback 'dev' pour les tests.
export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
```

Dans `env.d.ts` :
```ts
declare const __APP_VERSION__: string | undefined
```

Dans `electron.vite.config.ts` :
```ts
import pkg from './package.json'
// ...
renderer: {
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // ...
}
```

---

## Fichier 9 — `electron.vite.config.ts`

```ts
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json'

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  preload: { plugins: [externalizeDepsPlugin()] },
  renderer: {
    resolve: { alias: { '@renderer': resolve('src/renderer/src') } },
    plugins: [react(), tailwindcss()],
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/renderer/src/test-setup.ts'],
    },
  },
})
```

---

## Fichier 10 — `electron-builder.yml`

```yaml
appId: com.msgunify.app
productName: MsgUnify
directories:
  buildResources: build
files:
  - "!**/.vscode/*"
  - "!src/*"
  - "!electron.vite.config.{js,ts,mjs,cjs}"
  - "!{.eslintignore,.eslintrc.cjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}"
  - "!{.env,.env.*,.npmrc,pnpm-lock.yaml}"
  - "!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}"
asarUnpack:
  - resources/**
publish:
  provider: github
  owner: TON_USERNAME
  repo: msgunify
mac:
  entitlementsInherit: build/entitlements.mac.plist
  darkModeSupport: true
  category: public.app-category.social-networking
dmg:
  createUpdateZipFile: true
  window:
    width: 540
    height: 380
nsis:
  artifactName: ${name}-${version}-setup.${ext}
  shortcutName: ${productName}
  uninstallDisplayName: ${productName}
  createDesktopShortcut: always
win:
  executableName: msgunify
linux:
  target:
    - AppImage
    - snap
  maintainer: electronjs.org
  category: Utility
```

---

## Fichier 11 — `build/entitlements.mac.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
  </dict>
</plist>
```

---

## UI / Design

Thème sombre. Palette CSS :
```css
--bg-app: #1a1a1a;
--bg-sidebar: #0d0d0e;
--bg-input: rgba(255,255,255,0.06);
--text-primary: #fff;
--text-secondary: rgba(255,255,255,0.6);
--border: rgba(255,255,255,0.055);
--bg-modal: #161618;
```

**Sidebar (260px fixe)** :
- Logo app en haut
- Liste scrollable de `ServiceRow`
- Bouton "+" en bas pour ajouter un compte
- Version `v{APP_VERSION}` tout en bas

**ServiceRow** :
- Icône : cercle 34px couleur service, emoji centré + pastille 14px lettre du label en bas-à-droite
- Badge non-lu : pill arrondie, couleur service, glow
- Hover → bouton × apparaît (1er clic = rouge + "!" / 2e clic = suppression)
- Double-clic sur le label → édition inline (Enter/blur = save, Escape = annule)
- Active : bordure gauche 2px + fond légèrement éclairci

**UpdateBanner** (dans la sidebar, au-dessus du bouton "+") :
- `checking` → spinner "Vérification…"
- `available` → "Mise à jour v{X} disponible" + barre de progression
- `ready` → bouton vert "Redémarrer pour installer"

**AddAccountModal** :
- Grille 4 colonnes des 8 services
- Sélectionner un service → champ label + palette 15 couleurs
- Bouton "Ajouter" / "Annuler"

---

## Tests

`src/renderer/src/test-setup.ts` :
```ts
// @ts-ignore
globalThis.__APP_VERSION__ = 'test'
```

Écrire des tests pour :
- `badge.ts` : parseBadgeFromTitle avec 5 cas (0, nombre, parenthèses au début, etc.)
- `serviceTypes.ts` : vérifier que chaque service a les champs requis et que les URLs sont valides
- `Sidebar.tsx` : rendu avec comptes fictifs, badge, active state

---

## Démarrage

```bash
# 1. Créer le projet
npm create @quick-start/electron msgunify -- --template react-ts

# 2. Installer les dépendances
cd msgunify
npm install
npm install electron-updater
npm install -D @tailwindcss/vite tailwindcss vitest jsdom @vitest/globals

# 3. Remplacer les fichiers avec l'architecture ci-dessus

# 4. Dev
npm run dev

# 5. Build macOS
npm run build:mac
```

L'app sera fonctionnelle avec :
- Sessions persistantes (QR WhatsApp scanné une seule fois)
- Badges dans la sidebar + icône Dock macOS
- Notifications natives (même si la page est en arrière-plan)
- Liens externes ouverts dans le navigateur par défaut
- Micro fonctionnel dans les vocaux
- Raccourcis Cmd+1 à Cmd+9
- Ajout/suppression/renommage de comptes
- Auto-update via GitHub Releases
