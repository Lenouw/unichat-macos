import { app, BrowserWindow, shell, ipcMain, Notification, session, systemPreferences, screen } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import contextMenuModule from 'electron-context-menu'

// electron-context-menu est un paquet purement ESM, laissé hors du bundle par
// externalizeDepsPlugin. Le build CommonJS fait donc un require() dessus, et Node
// renvoie l'objet de module ({ default: fn }) au lieu de la fonction. On accepte
// les deux formes plutôt que de supposer laquelle arrive.
const contextMenu = (
  typeof contextMenuModule === 'function'
    ? contextMenuModule
    : (contextMenuModule as unknown as { default: typeof contextMenuModule }).default
) as typeof contextMenuModule
import { measureCaches, purgeAll, purgeOverLimit, CACHE_LIMIT_BYTES } from './cacheManager'
import { classifyPopup } from './popupPolicy'

// Plafond du cache disque par partition. Sans ça, Chromium dimensionne le cache
// selon l'espace libre et n'en redescend jamais : 9 comptes avaient accumulé 4,1 Go
// de cache HTTP. Doit être posé avant que l'app soit prête.
app.commandLine.appendSwitch('disk-cache-size', String(CACHE_LIMIT_BYTES))

// Forcer un userData stable pour que les sessions persistent entre builds dev et packagé.
// UNICHAT_USER_DATA permet de lancer l'app sur des données jetables pour un test de
// démarrage, sans toucher aux sessions réelles.
app.setPath(
  'userData',
  process.env.UNICHAT_USER_DATA || join(app.getPath('home'), 'Library', 'Application Support', 'UniChat')
)

// Format autorisé pour les IDs de compte : alphanumérique + tirets + underscores, 1-64 chars
const SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/
const SAFE_PARTITION_RE = /^persist:[a-zA-Z0-9_-]{1,128}$/

let mainWindow: BrowserWindow | null = null
const badges: Record<string, number> = {}
let registeredAccountIds: string[] = []
let registeredPartitions: string[] = []
let startupPurgeDone = false

// ─── Origines autorisées ─────────────────────────────────────────────────────
// Services du catalogue + domaines d'authentification associés.
// Toute navigation/permission hors de cette liste est refusée dans les webviews.
const ALLOWED_HOST_SUFFIXES = [
  // Services
  'whatsapp.com', 'whatsapp.net',
  'messenger.com', 'facebook.com', 'fbcdn.net',
  'teams.microsoft.com', 'microsoft.com', 'microsoftonline.com', 'live.com', 'office.com', 'sharepoint.com',
  'instagram.com', 'cdninstagram.com',
  'telegram.org',
  'slack.com', 'slack-edge.com',
  'discord.com', 'discordapp.com', 'discord.gg',
  'linkedin.com', 'licdn.com',
  // SSO courants
  'google.com', 'gstatic.com', 'googleusercontent.com',
  'apple.com',
]

// Origines pouvant obtenir micro/caméra (les services d'appels uniquement)
const MEDIA_HOST_SUFFIXES = [
  'whatsapp.com', 'messenger.com', 'facebook.com',
  'teams.microsoft.com', 'telegram.org',
  'slack.com', 'discord.com', 'instagram.com', 'linkedin.com',
]

function hostMatches(hostname: string, suffixes: string[]): boolean {
  return suffixes.some((s) => hostname === s || hostname.endsWith(`.${s}`))
}

function urlAllowed(url: string, suffixes: string[]): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    return hostMatches(parsed.hostname, suffixes)
  } catch {
    return false
  }
}

// ─── Permissions par origine ─────────────────────────────────────────────────
const MEDIA_PERMISSIONS = new Set(['media', 'microphone', 'audioCapture', 'camera', 'videoCapture'])
const GENERAL_PERMISSIONS = new Set(['notifications', 'clipboard-read'])
const appliedSessions = new WeakSet<Electron.Session>()

function permissionAllowed(permission: string, requestingUrl: string): boolean {
  if (MEDIA_PERMISSIONS.has(permission)) return urlAllowed(requestingUrl, MEDIA_HOST_SUFFIXES)
  if (GENERAL_PERMISSIONS.has(permission)) return urlAllowed(requestingUrl, ALLOWED_HOST_SUFFIXES)
  return false
}

function applyToSession(ses: Electron.Session): void {
  if (appliedSessions.has(ses)) return
  appliedSessions.add(ses)
  // Pages des comptes : WebAuthn désactivé avant tout script (voir preload/webauthnGuard.ts).
  // La session par défaut porte l'interface d'UniChat, pas un compte.
  if (ses !== session.defaultSession) {
    ses.registerPreloadScript({ type: 'frame', filePath: join(__dirname, '../preload/webview.js') })
  }
  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    const url = details?.requestingUrl || wc?.getURL() || ''
    callback(permissionAllowed(permission, url))
  })
  ses.setPermissionCheckHandler((wc, permission, requestingOrigin) => {
    const url = requestingOrigin || wc?.getURL() || ''
    return permissionAllowed(permission, url)
  })
  // Correcteur orthographique FR + EN dans les webviews
  try {
    ses.setSpellCheckerLanguages(['fr', 'en-US'])
  } catch {
    /* langue non dispo — non bloquant */
  }
}

// UNICHAT_DEBUG=1 journalise chaque décision de navigation et de popup :
// indispensable pour diagnostiquer un flux de connexion sans deviner.
const DEBUG = process.env.UNICHAT_DEBUG === '1'
function debugLog(...args: unknown[]): void {
  if (DEBUG) console.log('[unichat]', ...args)
}

// UNICHAT_DRY_EXTERNAL=1 : journalise au lieu d'ouvrir le navigateur (tests sans effet de bord)
function openInBrowser(url: string): void {
  if (process.env.UNICHAT_DRY_EXTERNAL === '1') {
    debugLog('ouverture navigateur (simulée)', url)
    return
  }
  shell.openExternal(url)
}

// ─── Contrôle des webviews (navigation, popups) ──────────────────────────────
function setupWebviewGovernance(): void {
  app.on('session-created', applyToSession)

  app.on('web-contents-created', (_event, contents) => {
    applyToSession(contents.session)

    if (contents.getType() !== 'webview') return

    // Popups. Deux cas à distinguer par la disposition que fournit Chromium :
    // - 'new-window' : fenêtre ouverte par script avec des dimensions, c'est la
    //   forme des popups de connexion (MSAL, SSO d'entreprise, Authenticator).
    //   Elle s'ouvre dans l'app, avec la session du compte, et peut aller vers
    //   n'importe quel fournisseur d'identité : ceux des entreprises (ADFS, Okta…)
    //   sont imprévisibles. about:blank en fait partie, MSAL ouvre la popup vide
    //   puis y injecte l'adresse.
    // - liens (target=_blank) : navigateur système, comme avant.
    // Les permissions micro/caméra restent filtrées par origine, indépendamment.
    contents.setWindowOpenHandler(({ url, disposition }) => {
      const authPopup = classifyPopup(url, disposition) === 'app'
      debugLog('popup demandée', disposition, url, authPopup ? 'DANS L’APP' : 'NAVIGATEUR')
      if (authPopup) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 520,
            height: 680,
            autoHideMenuBar: true,
            webPreferences: {
              // Même partition que le compte : le jeton obtenu dans la popup doit
              // atterrir dans la session de la webview qui l'a demandé
              session: contents.session,
              nodeIntegration: false,
              contextIsolation: true,
              sandbox: true,
            },
          },
        }
      }
      try {
        const parsed = new URL(url)
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') openInBrowser(url)
      } catch { /* URL invalide */ }
      return { action: 'deny' }
    })

    // Navigation dans la webview : tout https est permis, parce que les connexions
    // d'entreprise redirigent vers des serveurs d'identité impossibles à lister
    // (incident 2026-09-27 : ajout d'un compte Teams impossible). Les permissions
    // sensibles ne dépendent pas de ce filtre, elles sont accordées par origine.
    // Seuls les schémas non https sont bloqués.
    contents.on('will-navigate', (event, url) => {
      const ok = url.startsWith('https://')
      debugLog('navigation', url, ok ? 'ok' : 'BLOQUÉE')
      if (ok) return
      event.preventDefault()
      if (url.startsWith('http://')) openInBrowser(url)
    })

    contents.on('did-redirect-navigation', (_e, url) => debugLog('redirection', url))
    contents.on('did-navigate', (_e, url) => debugLog('arrivée', url))
    contents.on('did-create-window', (win) => {
      debugLog('fenêtre popup créée', win.webContents.getURL(), 'même session que le compte :', win.webContents.session === contents.session)
    })

    // Cmd+1-9 doit marcher aussi quand le focus est dans une webview
    contents.on('before-input-event', (event, input) => {
      handleAccountShortcut(event, input)
    })
  })
}

// ─── Raccourcis Cmd+1-9 (uniquement quand l'app a le focus) ──────────────────
// before-input-event au lieu de globalShortcut : ne vole plus Cmd+1-9
// aux autres apps macOS (Safari, Finder, VS Code…) quand UniChat est en fond
function handleAccountShortcut(event: Electron.Event, input: Electron.Input): void {
  if (input.type !== 'keyDown') return
  if (!input.meta || input.alt || input.shift || input.control) return
  const n = Number(input.key)
  if (!Number.isInteger(n) || n < 1 || n > 9) return
  const id = registeredAccountIds[n - 1]
  if (!id) return
  event.preventDefault()
  mainWindow?.webContents.send('service:select', id)
}

// ─── Persistance taille/position de fenêtre ──────────────────────────────────
const windowStateFile = join(app.getPath('userData'), 'window-state.json')

interface WindowState { x?: number; y?: number; width: number; height: number }

function loadWindowState(): WindowState {
  const fallback: WindowState = { width: 1200, height: 800 }
  try {
    const raw = JSON.parse(readFileSync(windowStateFile, 'utf8')) as WindowState
    if (typeof raw.width !== 'number' || typeof raw.height !== 'number') return fallback
    // Garde-fou : la fenêtre doit être visible sur un écran actuel (écran externe débranché…)
    if (typeof raw.x === 'number' && typeof raw.y === 'number') {
      const onScreen = screen.getAllDisplays().some((d) => {
        const b = d.workArea
        return raw.x! >= b.x - 100 && raw.y! >= b.y - 100 && raw.x! < b.x + b.width && raw.y! < b.y + b.height
      })
      if (!onScreen) {
        delete raw.x
        delete raw.y
      }
    }
    return { ...fallback, ...raw }
  } catch {
    return fallback
  }
}

function saveWindowState(): void {
  if (!mainWindow) return
  try {
    writeFileSync(windowStateFile, JSON.stringify(mainWindow.getBounds()))
  } catch { /* disque en lecture seule — non bloquant */ }
}

// ─── Auto-update ─────────────────────────────────────────────────────────────
function setupAutoUpdater(): void {
  // Pas de check en dev — uniquement en production
  if (is.dev) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('update:checking')
  })

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update:available', info.version)
  })

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update:not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update:progress', Math.round(progress.percent))
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update:ready', info.version)
  })

  autoUpdater.on('error', () => {
    // Sortir la bannière d'un éventuel état "Téléchargement…" bloqué
    mainWindow?.webContents.send('update:not-available')
  })

  // Check au démarrage, puis toutes les 4 heures
  app.whenReady().then(() => {
    setTimeout(() => autoUpdater.checkForUpdates(), 3000)
    setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000)
  })
}

// ─── Badge dock ──────────────────────────────────────────────────────────────
function refreshDockBadge(): void {
  const total = Object.values(badges).reduce((sum, n) => sum + n, 0)
  app.dock?.setBadge(total > 0 ? String(total) : '')
}

// ─── IPC ─────────────────────────────────────────────────────────────────────
function setupIPC(): void {
  ipcMain.on('badge:update', (_event, payload: unknown) => {
    if (typeof payload !== 'object' || payload === null) return
    const { serviceId, count } = payload as Record<string, unknown>
    if (typeof serviceId !== 'string' || !SAFE_ID_RE.test(serviceId)) return
    if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) return

    badges[serviceId] = Math.floor(count)
    refreshDockBadge()
  })

  ipcMain.on('notification:show', (_event, payload: unknown) => {
    if (typeof payload !== 'object' || payload === null) return
    const { serviceId, title, body } = payload as Record<string, unknown>
    if (typeof title !== 'string' || typeof body !== 'string') return
    const safeTitle = title.slice(0, 100)
    const safeBody = body.slice(0, 300)
    if (!Notification.isSupported()) return

    const notification = new Notification({ title: safeTitle, body: safeBody })
    // Clic sur la notif → focus de l'app + sélection du compte source
    if (typeof serviceId === 'string' && SAFE_ID_RE.test(serviceId)) {
      notification.on('click', () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.show()
          mainWindow.focus()
          mainWindow.webContents.send('service:select', serviceId)
        }
      })
    }
    notification.show()
  })

  ipcMain.on('accounts:register', (_event, payload: unknown) => {
    const p = (typeof payload === 'object' && payload !== null) ? payload as Record<string, unknown> : {}
    const ids = Array.isArray(p.ids) ? p.ids : []
    const partitions = Array.isArray(p.partitions) ? p.partitions : []

    const validIds = ids.filter((id): id is string =>
      typeof id === 'string' && SAFE_ID_RE.test(id)
    )
    registeredAccountIds = validIds.slice(0, 9)

    // Purger les badges des comptes qui n'existent plus (sinon le total
    // du dock inclut indéfiniment les non-lus d'un compte supprimé)
    const validSet = new Set(validIds)
    Object.keys(badges).forEach((id) => {
      if (!validSet.has(id)) delete badges[id]
    })
    refreshDockBadge()

    // Appliquer les permissions aux sessions des comptes dynamiques
    const validPartitions = partitions.filter((part): part is string =>
      typeof part === 'string' && SAFE_PARTITION_RE.test(part)
    )
    validPartitions.forEach((part) => applyToSession(session.fromPartition(part)))
    registeredPartitions = validPartitions

    // Purge d'entretien, une seule fois par lancement et avant que les webviews
    // ne chargent : seules les partitions au-dessus du plafond sont vidées
    if (!startupPurgeDone && validPartitions.length > 0) {
      startupPurgeDone = true
      purgeOverLimit(validPartitions).catch(() => {})
    }
  })

  // Taille cumulée du cache HTTP, pour l'affichage dans la barre latérale
  ipcMain.handle('cache:size', async () => {
    return measureCaches(registeredPartitions)
  })

  // Purge manuelle déclenchée depuis l'interface. Retourne les octets libérés.
  ipcMain.handle('cache:purge', async () => {
    return purgeAll(registeredPartitions)
  })

  // Suppression de compte : effacer les données de session sur disque
  // (cookies, session WhatsApp, cache) — sinon elles restent indéfiniment
  ipcMain.on('session:clear', (_event, partition: unknown) => {
    if (typeof partition !== 'string' || !SAFE_PARTITION_RE.test(partition)) return
    session.fromPartition(partition).clearStorageData().catch(() => {})
  })

  // L'utilisateur a cliqué "Redémarrer pour installer"
  ipcMain.on('update:install', () => {
    autoUpdater.quitAndInstall()
  })

  // Ouvrir un lien externe dans le navigateur par défaut
  ipcMain.on('open:external', (_event, url: unknown) => {
    if (typeof url !== 'string') return
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        shell.openExternal(url)
      }
    } catch { /* URL invalide */ }
  })
}

// ─── Fenêtre principale ──────────────────────────────────────────────────────
function createWindow(): void {
  const state = loadWindowState()

  mainWindow = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a1a',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', saveWindowState)

  // Défense en profondeur : verrouiller les attributs des webviews côté main
  mainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    delete webPreferences.preload
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
    if (typeof params.src === 'string' && !urlAllowed(params.src, ALLOWED_HOST_SUFFIXES)) {
      event.preventDefault()
    }
  })

  // Cmd+1-9 quand le focus est dans le renderer (sidebar)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    handleAccountShortcut(event, input)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        shell.openExternal(url)
      }
    } catch {
      // URL invalide — ignorer
    }
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
// Empêche deux instances de l'app de tourner simultanément
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  // Menu contextuel clic droit (copier/coller, correcteur, images) dans
  // toutes les webviews — comportement macOS standard
  contextMenu({
    showSaveImageAs: true,
    showCopyImageAddress: false,
    showSearchWithGoogle: false,
    showInspectElement: is.dev,
    labels: {
      cut: 'Couper',
      copy: 'Copier',
      paste: 'Coller',
      copyLink: 'Copier le lien',
      copyImage: "Copier l'image",
      saveImageAs: "Enregistrer l'image sous…",
      selectAll: 'Tout sélectionner',
      learnSpelling: 'Mémoriser l’orthographe',
      lookUpSelection: 'Rechercher « {selection} »',
    },
  })

  setupAutoUpdater()

  app.whenReady().then(async () => {
    // Demande la permission micro à macOS.
    // Si macOS retourne false (permission refusée ou jamais demandée), ouvre les Réglages Système
    // directement sur la page Microphone pour que l'utilisateur puisse l'activer manuellement.
    if (process.platform === 'darwin') {
      const granted = await systemPreferences.askForMediaAccess('microphone')
      if (!granted) {
        shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone')
      }
    }

    applyToSession(session.defaultSession)
    setupWebviewGovernance()
    setupIPC()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
