# UniChat MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fast, native macOS app centralisant 3 comptes WhatsApp + Messenger + Teams dans des webviews isolées avec sessions persistantes.

**Architecture:** Electron-vite + React + TypeScript. Une sidebar React légère + 5 webviews Chromium isolés par `partition="persist:X"`. Les webviews sont chargées lazily (à la première visite) puis gardées en mémoire avec CSS show/hide — jamais unmount/remount. Les badges sont lus depuis le `title` de chaque page (WhatsApp/Messenger/Teams mettent le compteur dans le titre).

**Tech Stack:** electron-vite, React 18, TypeScript, Tailwind CSS v4, electron-builder (packaging).

**Principe de performance :**
- Lazy load : webview créée uniquement à la première visite
- Show/hide CSS : changer d'onglet = `display: none/block` (0ms, pas de re-render)
- Badge via `webview.getTitle()` : polling léger toutes les 2s, pas d'injection DOM
- Aucune dépendance lourde (pas de MobX, Redux, etc.)

---

## File Map

```
unichat/
├── package.json
├── electron-builder.yml
├── electron.vite.config.ts
├── tsconfig.json
├── src/
│   ├── main/
│   │   └── index.ts              # Main process : fenêtre, IPC, dock badge, notifications
│   ├── preload/
│   │   └── index.ts              # contextBridge : expose API sécurisée au renderer
│   └── renderer/
│       ├── index.html
│       ├── main.tsx              # React entry point
│       ├── App.tsx               # Layout root : Sidebar + WebviewManager
│       ├── config/
│       │   └── services.ts       # Définition des 5 services (URL, partition, label, icône)
│       ├── hooks/
│       │   └── useBadges.ts      # Hook qui poll les titres des webviews toutes les 2s
│       ├── components/
│       │   ├── Sidebar.tsx       # Liste des services + badges + sélection active
│       │   └── WebviewManager.tsx # Crée/montre/cache les 5 webviews
│       └── styles/
│           └── globals.css       # Tailwind imports
└── resources/
    └── icon.png                  # Icône app (512x512)
```

---

## Task 1 : Scaffold electron-vite

**Files:**
- Create: `unichat/` (nouveau dossier projet)
- Create: `package.json`, `electron.vite.config.ts`, `tsconfig.json`, `electron-builder.yml`

- [ ] **Step 1 : Initialiser le projet avec electron-vite**

```bash
cd "/Users/florianbonin/CosyCosa Dropbox/Flo bip/Files PRO/CLAUDE CODE/App Whatsapp multi"
npm create @quick-start/electron@latest unichat -- --template react-ts
cd unichat
npm install
```

Expected : `unichat/` créé avec structure `src/main`, `src/preload`, `src/renderer`.

- [ ] **Step 2 : Ajouter Tailwind CSS v4**

```bash
npm install tailwindcss @tailwindcss/vite
```

Dans `electron.vite.config.ts`, ajouter le plugin Tailwind au renderer :

```typescript
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react(), tailwindcss()]
  }
})
```

- [ ] **Step 3 : Configurer globals.css**

Remplacer `src/renderer/src/assets/` par `src/renderer/src/styles/globals.css` :

```css
@import "tailwindcss";

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
  background: #1a1a1a;
  color: #fff;
  overflow: hidden;
}
```

Dans `src/renderer/src/main.tsx`, importer `'./styles/globals.css'` à la place de l'ancien CSS.

- [ ] **Step 4 : Vérifier que ça démarre**

```bash
npm run dev
```

Expected : fenêtre Electron s'ouvre avec la page React par défaut (le template electron-vite). Pas d'erreur dans la console.

- [ ] **Step 5 : Commit**

```bash
cd "/Users/florianbonin/CosyCosa Dropbox/Flo bip/Files PRO/CLAUDE CODE/App Whatsapp multi"
git add unichat/
git commit -m "Scaffold : electron-vite + React + TypeScript + Tailwind"
```

---

## Task 2 : Définir les services

**Files:**
- Create: `src/renderer/src/config/services.ts`
- Create: `src/shared/types.ts`

- [ ] **Step 1 : Créer les types partagés**

Créer `src/renderer/src/config/services.ts` :

```typescript
export interface Service {
  id: string
  label: string
  url: string
  partition: string
  color: string       // couleur du badge dans la sidebar
  userAgent?: string  // UA override si nécessaire
}

export const SERVICES: Service[] = [
  {
    id: 'wa-perso',
    label: 'WhatsApp Perso',
    url: 'https://web.whatsapp.com',
    partition: 'persist:wa-perso',
    color: '#25D366',
  },
  {
    id: 'wa-pro1',
    label: 'WhatsApp Pro 1',
    url: 'https://web.whatsapp.com',
    partition: 'persist:wa-pro1',
    color: '#128C7E',
  },
  {
    id: 'wa-pro2',
    label: 'WhatsApp Pro 2',
    url: 'https://web.whatsapp.com',
    partition: 'persist:wa-pro2',
    color: '#075E54',
  },
  {
    id: 'messenger',
    label: 'Messenger',
    url: 'https://www.messenger.com',
    partition: 'persist:messenger',
    color: '#0099FF',
  },
  {
    id: 'teams',
    label: 'Teams',
    url: 'https://teams.microsoft.com',
    partition: 'persist:teams',
    color: '#6264A7',
  },
]
```

- [ ] **Step 2 : Écrire un test unitaire de la config**

Créer `src/renderer/src/config/services.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { SERVICES } from './services'

describe('SERVICES config', () => {
  it('contient exactement 5 services', () => {
    expect(SERVICES).toHaveLength(5)
  })

  it('chaque service a un id unique', () => {
    const ids = SERVICES.map(s => s.id)
    expect(new Set(ids).size).toBe(SERVICES.length)
  })

  it('chaque service a une partition unique (sessions isolées)', () => {
    const partitions = SERVICES.map(s => s.partition)
    expect(new Set(partitions).size).toBe(SERVICES.length)
  })

  it('les partitions WhatsApp sont toutes différentes', () => {
    const waServices = SERVICES.filter(s => s.id.startsWith('wa-'))
    const waPartitions = waServices.map(s => s.partition)
    expect(new Set(waPartitions).size).toBe(3)
  })

  it('chaque service a une URL valide', () => {
    SERVICES.forEach(s => {
      expect(() => new URL(s.url)).not.toThrow()
    })
  })
})
```

- [ ] **Step 3 : Ajouter vitest à la config renderer**

Dans `electron.vite.config.ts`, section renderer, ajouter :

```typescript
renderer: {
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
  }
}
```

Dans `package.json`, ajouter le script :

```json
"test": "vitest run src/renderer/src"
```

- [ ] **Step 4 : Lancer les tests — ils doivent passer**

```bash
npm test
```

Expected : 5 tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add .
git commit -m "Config : définition des 5 services avec tests"
```

---

## Task 3 : Main process — fenêtre et configuration

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1 : Configurer la BrowserWindow principale**

Remplacer le contenu de `src/main/index.ts` par :

```typescript
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset', // barre macOS native avec boutons trafic-light
    backgroundColor: '#1a1a1a',   // évite le flash blanc au démarrage
    show: false,                   // on attend 'ready-to-show'
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Afficher la fenêtre seulement quand elle est prête (évite le flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Ouvrir les liens externes dans le navigateur système
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 2 : Vérifier le démarrage**

```bash
npm run dev
```

Expected : fenêtre macOS native avec barre de titre transparente, fond sombre, sans flash blanc. Les boutons trafic-light (rouge/jaune/vert) sont visibles.

- [ ] **Step 3 : Commit**

```bash
git add .
git commit -m "Main process : fenêtre macOS native, fond sombre, pas de flash"
```

---

## Task 4 : IPC Bridge (contextBridge)

**Files:**
- Modify: `src/preload/index.ts`
- Modify: `src/main/index.ts` (ajout handlers IPC)

- [ ] **Step 1 : Définir l'API contextBridge dans le preload**

Remplacer `src/preload/index.ts` :

```typescript
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('unichat', {
  // Mettre à jour le badge d'un service (envoyé depuis le renderer)
  setBadge: (serviceId: string, count: number) =>
    ipcRenderer.send('badge:update', { serviceId, count }),

  // Déclencher une notification macOS
  notify: (serviceId: string, title: string, body: string) =>
    ipcRenderer.send('notification:show', { serviceId, title, body }),
})

// Types pour TypeScript dans le renderer
declare global {
  interface Window {
    unichat: {
      setBadge: (serviceId: string, count: number) => void
      notify: (serviceId: string, title: string, body: string) => void
    }
  }
}
```

- [ ] **Step 2 : Ajouter les handlers IPC dans le main process**

Dans `src/main/index.ts`, ajouter après les imports :

```typescript
import { app, BrowserWindow, shell, ipcMain, Notification } from 'electron'

// Stocke les badges par serviceId pour calculer le total
const badges: Record<string, number> = {}

function setupIPC(): void {
  // Mise à jour badge : recalcule le total et met à jour le Dock
  ipcMain.on('badge:update', (_event, { serviceId, count }: { serviceId: string; count: number }) => {
    badges[serviceId] = count
    const total = Object.values(badges).reduce((sum, n) => sum + n, 0)
    app.dock.setBadge(total > 0 ? String(total) : '')
  })

  // Notification macOS native
  ipcMain.on('notification:show', (_event, { title, body }: { title: string; body: string }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show()
    }
  })
}
```

Dans `app.whenReady().then(...)`, appeler `setupIPC()` avant `createWindow()`.

- [ ] **Step 3 : Vérifier qu'il n'y a pas d'erreur TypeScript**

```bash
npm run typecheck
```

Expected : aucune erreur TypeScript.

- [ ] **Step 4 : Commit**

```bash
git add .
git commit -m "IPC : contextBridge badge+notification, handlers main process"
```

---

## Task 5 : Sidebar

**Files:**
- Create: `src/renderer/src/components/Sidebar.tsx`

- [ ] **Step 1 : Créer le composant Sidebar**

Créer `src/renderer/src/components/Sidebar.tsx` :

```typescript
import { SERVICES, Service } from '../config/services'

interface SidebarProps {
  activeId: string
  badges: Record<string, number>
  onSelect: (id: string) => void
}

export function Sidebar({ activeId, badges, onSelect }: SidebarProps) {
  return (
    <aside className="flex flex-col w-16 bg-[#111] border-r border-white/10 pt-10 pb-4 items-center gap-2 shrink-0">
      {SERVICES.map((service) => (
        <ServiceButton
          key={service.id}
          service={service}
          isActive={activeId === service.id}
          badge={badges[service.id] ?? 0}
          onClick={() => onSelect(service.id)}
        />
      ))}
    </aside>
  )
}

function ServiceButton({
  service,
  isActive,
  badge,
  onClick,
}: {
  service: Service
  isActive: boolean
  badge: number
  onClick: () => void
}) {
  // Initiales du service (ex: "WP" pour "WhatsApp Perso")
  const initials = service.label
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <button
      onClick={onClick}
      title={service.label}
      className={`relative w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold
        transition-all duration-150 cursor-default select-none
        ${isActive ? 'ring-2 ring-white/40 scale-105' : 'opacity-60 hover:opacity-90'}`}
      style={{ backgroundColor: service.color }}
    >
      {initials}
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold
          rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}
```

- [ ] **Step 2 : Écrire un test pour la Sidebar**

Créer `src/renderer/src/components/Sidebar.test.tsx` :

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Sidebar } from './Sidebar'

// Mock window.unichat (pas disponible hors Electron)
vi.stubGlobal('unichat', { setBadge: vi.fn(), notify: vi.fn() })

describe('Sidebar', () => {
  const defaultProps = {
    activeId: 'wa-perso',
    badges: {},
    onSelect: vi.fn(),
  }

  it('affiche 5 boutons de service', () => {
    render(<Sidebar {...defaultProps} />)
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })

  it('affiche les labels en title sur les boutons', () => {
    render(<Sidebar {...defaultProps} />)
    expect(screen.getByTitle('WhatsApp Perso')).toBeDefined()
    expect(screen.getByTitle('Messenger')).toBeDefined()
    expect(screen.getByTitle('Teams')).toBeDefined()
  })

  it('appelle onSelect avec le bon id au clic', () => {
    const onSelect = vi.fn()
    render(<Sidebar {...defaultProps} onSelect={onSelect} />)
    fireEvent.click(screen.getByTitle('Messenger'))
    expect(onSelect).toHaveBeenCalledWith('messenger')
  })

  it('affiche un badge quand count > 0', () => {
    render(<Sidebar {...defaultProps} badges={{ 'wa-perso': 3 }} />)
    expect(screen.getByText('3')).toBeDefined()
  })

  it('affiche 99+ pour les badges > 99', () => {
    render(<Sidebar {...defaultProps} badges={{ messenger: 150 }} />)
    expect(screen.getByText('99+')).toBeDefined()
  })

  it("n'affiche pas de badge quand count === 0", () => {
    render(<Sidebar {...defaultProps} badges={{ 'wa-perso': 0 }} />)
    expect(screen.queryByText('0')).toBeNull()
  })
})
```

- [ ] **Step 3 : Installer @testing-library/react**

```bash
npm install -D @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 4 : Lancer les tests**

```bash
npm test
```

Expected : tous les tests de Sidebar passent (6 tests).

- [ ] **Step 5 : Commit**

```bash
git add .
git commit -m "Sidebar : composant avec badges, couleurs par service, tests"
```

---

## Task 6 : WebviewManager — lazy load + show/hide

**Files:**
- Create: `src/renderer/src/components/WebviewManager.tsx`

- [ ] **Step 1 : Créer le WebviewManager**

Créer `src/renderer/src/components/WebviewManager.tsx` :

```typescript
import { useEffect, useRef } from 'react'
import { SERVICES } from '../config/services'

// UA Chrome macOS — nécessaire pour WhatsApp et Messenger
const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

interface WebviewManagerProps {
  activeId: string
  onBadgeChange: (serviceId: string, count: number) => void
}

export function WebviewManager({ activeId, onBadgeChange }: WebviewManagerProps) {
  // Track quels services ont déjà été chargés (lazy)
  const loadedRef = useRef<Set<string>>(new Set([activeId]))

  // Marquer le service actif comme "à charger"
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
      // Démarrer le polling des badges dès que la page est chargée
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(() => {
        const title = webview.getTitle()
        const match = title.match(/\((\d+)\)/)
        const count = match ? parseInt(match[1], 10) : 0
        onBadgeChange(serviceId, count)
      }, 2000)
    }

    webview.addEventListener('did-finish-load', handleDidFinishLoad)

    return () => {
      webview.removeEventListener('did-finish-load', handleDidFinishLoad)
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [serviceId, onBadgeChange])

  return (
    <webview
      ref={webviewRef}
      src={url}
      partition={partition}
      useragent={CHROME_UA}
      // @ts-expect-error — attribut Electron non standard
      disablewebsecurity="true"
      allowpopups="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: visible ? 'flex' : 'none', // show/hide, jamais unmount
      }}
    />
  )
}
```

- [ ] **Step 2 : Écrire un test unitaire pour la logique de badge**

Créer `src/renderer/src/components/badge.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'

// Logique extraite pour être testable indépendamment
function parseBadgeFromTitle(title: string): number {
  const match = title.match(/\((\d+)\)/)
  return match ? parseInt(match[1], 10) : 0
}

describe('parseBadgeFromTitle', () => {
  it('retourne 0 pour un titre sans badge', () => {
    expect(parseBadgeFromTitle('WhatsApp')).toBe(0)
  })

  it('extrait le count depuis "WhatsApp (3)"', () => {
    expect(parseBadgeFromTitle('WhatsApp (3)')).toBe(3)
  })

  it('extrait le count depuis "(5) Microsoft Teams"', () => {
    expect(parseBadgeFromTitle('(5) Microsoft Teams')).toBe(5)
  })

  it('extrait le count depuis "Messenger (12)"', () => {
    expect(parseBadgeFromTitle('Messenger (12)')).toBe(12)
  })

  it('retourne 0 pour un titre vide', () => {
    expect(parseBadgeFromTitle('')).toBe(0)
  })
})
```

- [ ] **Step 3 : Lancer les tests**

```bash
npm test
```

Expected : tests badge passent (5 tests).

- [ ] **Step 4 : Activer le tag `<webview>` dans Electron**

Dans `src/main/index.ts`, avant `app.whenReady()`, ajouter :

```typescript
app.commandLine.appendSwitch('enable-features', 'WebviewTag')
```

Dans `createWindow()`, dans `webPreferences`, ajouter :

```typescript
webviewTag: true,
```

- [ ] **Step 5 : Commit**

```bash
git add .
git commit -m "WebviewManager : lazy load, show/hide CSS, badge polling depuis title"
```

---

## Task 7 : App.tsx — assembler tout

**Files:**
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1 : Réécrire App.tsx**

```typescript
import { useState, useCallback } from 'react'
import { Sidebar } from './components/Sidebar'
import { WebviewManager } from './components/WebviewManager'
import { SERVICES } from './config/services'

export default function App() {
  const [activeId, setActiveId] = useState(SERVICES[0].id)
  const [badges, setBadges] = useState<Record<string, number>>({})

  const handleBadgeChange = useCallback((serviceId: string, count: number) => {
    setBadges((prev) => {
      if (prev[serviceId] === count) return prev // évite les re-renders inutiles
      const next = { ...prev, [serviceId]: count }
      // Propager vers le main process (Dock badge)
      window.unichat.setBadge(serviceId, count)
      return next
    })
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar activeId={activeId} badges={badges} onSelect={setActiveId} />
      <WebviewManager activeId={activeId} onBadgeChange={handleBadgeChange} />
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier le rendu dans l'app**

```bash
npm run dev
```

Expected :
- Sidebar sombre à gauche avec 5 boutons colorés
- Le premier service (WhatsApp Perso) se charge à droite
- Cliquer sur un autre service l'affiche (lazy load au premier clic)
- Revenir au premier service : instantané (show/hide, pas de rechargement)

- [ ] **Step 3 : Commit**

```bash
git add .
git commit -m "App : layout complet sidebar + webviews, badges propagés au Dock"
```

---

## Task 8 : Raccourcis clavier Cmd+1-5

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1 : Ajouter les globalShortcuts**

Dans `src/main/index.ts`, importer `globalShortcut` et ajouter dans `app.whenReady()` :

```typescript
import { app, BrowserWindow, shell, ipcMain, Notification, globalShortcut } from 'electron'

// Dans app.whenReady().then(() => { ... })
SERVICES_IDS.forEach((id, index) => {
  globalShortcut.register(`CommandOrControl+${index + 1}`, () => {
    mainWindow?.webContents.send('service:select', id)
  })
})
```

Ajouter en haut du fichier :

```typescript
// IDs dans le même ordre que SERVICES dans le renderer
const SERVICES_IDS = ['wa-perso', 'wa-pro1', 'wa-pro2', 'messenger', 'teams']
```

Libérer les shortcuts à la fermeture :

```typescript
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
```

- [ ] **Step 2 : Écouter l'événement dans le renderer**

Dans `src/preload/index.ts`, ajouter dans l'API exposée :

```typescript
onServiceSelect: (callback: (id: string) => void) =>
  ipcRenderer.on('service:select', (_event, id) => callback(id)),
```

Et dans la déclaration TypeScript :

```typescript
onServiceSelect: (callback: (id: string) => void) => void
```

Dans `src/renderer/src/App.tsx`, ajouter un `useEffect` :

```typescript
useEffect(() => {
  window.unichat.onServiceSelect((id) => {
    setActiveId(id)
  })
}, [])
```

- [ ] **Step 3 : Tester manuellement**

```bash
npm run dev
```

Expected : Cmd+1 → WhatsApp Perso actif, Cmd+4 → Messenger actif, Cmd+5 → Teams actif.

- [ ] **Step 4 : Commit**

```bash
git add .
git commit -m "Raccourcis Cmd+1-5 pour naviguer entre les services"
```

---

## Task 9 : Notifications macOS

**Files:**
- Modify: `src/renderer/src/components/WebviewManager.tsx`

- [ ] **Step 1 : Intercepter les notifications des webviews**

Dans `WebviewPane`, dans le `useEffect`, ajouter après `handleDidFinishLoad` :

```typescript
const handleIpcMessage = (event: Electron.IpcMessageEvent) => {
  if (event.channel === 'notification') {
    const [title, body] = event.args as [string, string]
    window.unichat.notify(serviceId, title, body)
  }
}

// Injecter un script qui intercepte window.Notification
const handleDomReady = () => {
  webview.executeJavaScript(`
    const _OriginalNotification = window.Notification
    window.Notification = function(title, options) {
      window.electronIpcRenderer?.send?.('notification', title, options?.body ?? '')
      // Créer quand même la notif native du webview (silencieuse)
      return new _OriginalNotification(title, options)
    }
    window.Notification.permission = 'granted'
    window.Notification.requestPermission = () => Promise.resolve('granted')
  `)
}

webview.addEventListener('ipc-message', handleIpcMessage)
webview.addEventListener('dom-ready', handleDomReady)

return () => {
  webview.removeEventListener('did-finish-load', handleDidFinishLoad)
  webview.removeEventListener('ipc-message', handleIpcMessage)
  webview.removeEventListener('dom-ready', handleDomReady)
  if (pollRef.current) clearInterval(pollRef.current)
}
```

**Note :** Les webviews avec `disablewebsecurity` et `partition` isolées ont accès à `window.electronIpcRenderer` via un preload séparé. Si ce n'est pas disponible, les notifications du webview seront simplement bloquées sans erreur — le badge polling suffit pour les compteurs.

- [ ] **Step 2 : Demander la permission notification à macOS**

Dans `src/main/index.ts`, dans `app.whenReady()` :

```typescript
// macOS : demander la permission une seule fois
if (process.platform === 'darwin') {
  app.setActivationPolicy('regular')
}
```

- [ ] **Step 3 : Tester manuellement**

```bash
npm run dev
```

Recevoir un message WhatsApp — Expected : notification macOS native apparaît avec le titre de la conversation et le début du message.

- [ ] **Step 4 : Commit**

```bash
git add .
git commit -m "Notifications macOS natives depuis les webviews"
```

---

## Task 10 : Build et packaging macOS

**Files:**
- Create: `electron-builder.yml`
- Create: `resources/icon.png` (à fournir par l'utilisateur — 512x512 PNG)

- [ ] **Step 1 : Créer electron-builder.yml**

```yaml
appId: com.unichat.app
productName: UniChat
copyright: Copyright © 2026

mac:
  category: public.app-category.social-networking
  target:
    - target: dmg
      arch: [arm64, x64]
  icon: resources/icon.png
  darkModeSupport: true

dmg:
  title: UniChat
  background: resources/dmg-background.png
  window:
    width: 540
    height: 380

files:
  - '!**/.vscode/*'
  - '!src/*'
  - '!electron.vite.config.*'
  - '!{.eslintignore,.eslintrc.cjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}'
  - '!{.env,.env.*,.npmrc,pnpm-lock.yaml}'

nsis:
  artifactName: ${name}-${version}-setup.${ext}
  shortcutName: ${productName}
  uninstallDisplayName: ${productName}
  createDesktopShortcut: always
```

- [ ] **Step 2 : Créer une icône placeholder**

Si tu n'as pas encore l'icône finale, créer une icône temporaire (512x512 PNG). Un outil comme https://www.canva.com ou simplement une couleur unie suffit pour tester le build.

Place-la dans `resources/icon.png`.

- [ ] **Step 3 : Builder l'app**

```bash
npm run build
npm run build:mac
```

Expected : dossier `dist/` créé avec un `.dmg` et un `.app`.

- [ ] **Step 4 : Tester l'app packagée**

Ouvrir le `.dmg`, glisser UniChat dans Applications, lancer l'app.

Expected :
- L'app se lance
- Toutes les sessions WhatsApp sont mémorisées (pas de re-scan QR)
- Cmd+1-5 fonctionnent
- Badges dans la sidebar mis à jour

- [ ] **Step 5 : Commit final**

```bash
cd "/Users/florianbonin/CosyCosa Dropbox/Flo bip/Files PRO/CLAUDE CODE/App Whatsapp multi"
git add .
git commit -m "Build macOS : packaging DMG arm64+x64, icône, config electron-builder"
```

---

## Récapitulatif des performances attendues

| Métrique | Valeur cible | Mécanisme |
|---|---|---|
| Démarrage (cold) | < 2s | `show: false` + `ready-to-show`, fond sombre pour masquer le chargement |
| Changement d'onglet | < 50ms | CSS show/hide, jamais unmount/remount |
| Badge update | ≤ 2s de délai | Polling `getTitle()` toutes les 2s |
| RAM au repos (5 webviews) | ~600-800 MB | Trade-off Electron inévitable |
| Bundle app | ~200-300 MB | Chromium bundlé dans Electron |

---

## Ordre d'exécution recommandé

1 → 2 → 3 → 4 → 5 → 6 → 7 (app fonctionnelle) → 8 → 9 → 10

Les tâches 1-7 donnent une app fonctionnelle. Les tâches 8-9 ajoutent le polish. La tâche 10 est le packaging final.
