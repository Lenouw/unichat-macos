import { app, BrowserWindow, shell, ipcMain, Notification, globalShortcut, session } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'

// Forcer un userData stable pour que les sessions persistent entre builds dev et packagé
app.setPath('userData', join(app.getPath('home'), 'Library', 'Application Support', 'UniChat'))

// Format autorisé pour les IDs de compte : alphanumérique + tirets + underscores, 1-64 chars
const SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/

let mainWindow: BrowserWindow | null = null
const badges: Record<string, number> = {}
let registeredAccountIds: string[] = []

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
    // Silencieux — l'utilisateur n'est pas alerté des erreurs réseau passagères
  })

  // Check au démarrage, puis toutes les 4 heures
  app.whenReady().then(() => {
    setTimeout(() => autoUpdater.checkForUpdates(), 3000)
    setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000)
  })
}

function setupMediaPermissions(): void {
  const allowedPermissions = new Set(['media', 'microphone', 'audioCapture', 'notifications', 'clipboard-read'])

  const applyToSession = (ses: Electron.Session): void => {
    ses.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(allowedPermissions.has(permission))
    })
    ses.setPermissionCheckHandler((_wc, permission) => {
      return allowedPermissions.has(permission)
    })
  }

  // Appliquer immédiatement aux partitions connues déjà présentes sur disque
  // (session-created ne fire PAS pour les sessions chargées depuis le cache Electron)
  const knownPartitions = ['wa-perso', 'wa-pro1', 'wa-pro2', 'messenger', 'teams']
  knownPartitions.forEach((id) => applyToSession(session.fromPartition(`persist:${id}`)))

  // Attraper toutes les nouvelles sessions créées dynamiquement (nouveaux comptes)
  app.on('session-created', applyToSession)
}

function setupIPC(): void {
  ipcMain.on('badge:update', (_event, payload: unknown) => {
    if (typeof payload !== 'object' || payload === null) return
    const { serviceId, count } = payload as Record<string, unknown>
    if (typeof serviceId !== 'string' || !SAFE_ID_RE.test(serviceId)) return
    if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) return

    badges[serviceId] = Math.floor(count)
    const total = Object.values(badges).reduce((sum, n) => sum + n, 0)
    app.dock?.setBadge(total > 0 ? String(total) : '')
  })

  ipcMain.on('notification:show', (_event, payload: unknown) => {
    if (typeof payload !== 'object' || payload === null) return
    const { title, body } = payload as Record<string, unknown>
    if (typeof title !== 'string' || typeof body !== 'string') return
    const safeTitle = title.slice(0, 100)
    const safeBody = body.slice(0, 300)
    if (Notification.isSupported()) {
      new Notification({ title: safeTitle, body: safeBody }).show()
    }
  })

  ipcMain.on('accounts:register', (_event, ids: unknown) => {
    if (!Array.isArray(ids)) return
    const validIds = ids.filter((id): id is string =>
      typeof id === 'string' && SAFE_ID_RE.test(id)
    )
    registeredAccountIds = validIds.slice(0, 9)

    globalShortcut.unregisterAll()
    registeredAccountIds.forEach((id, index) => {
      globalShortcut.register(`CommandOrControl+${index + 1}`, () => {
        mainWindow?.webContents.send('service:select', id)
      })
    })
  })

  // L'utilisateur a cliqué "Redémarrer pour installer"
  ipcMain.on('update:install', () => {
    autoUpdater.quitAndInstall()
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a1a',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
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

setupAutoUpdater()

app.whenReady().then(() => {
  setupMediaPermissions()
  setupIPC()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
