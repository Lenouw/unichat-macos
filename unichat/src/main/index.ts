import { app, BrowserWindow, shell, ipcMain, Notification, globalShortcut } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

const SERVICES_IDS = ['wa-perso', 'wa-pro1', 'wa-pro2', 'messenger', 'teams']
const VALID_SERVICE_IDS = new Set(['wa-perso', 'wa-pro1', 'wa-pro2', 'messenger', 'teams'])

let mainWindow: BrowserWindow | null = null
const badges: Record<string, number> = {}

function setupIPC(): void {
  ipcMain.on('badge:update', (_event, payload: unknown) => {
    if (typeof payload !== 'object' || payload === null) return
    const { serviceId, count } = payload as Record<string, unknown>
    if (typeof serviceId !== 'string' || !VALID_SERVICE_IDS.has(serviceId)) return
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

app.whenReady().then(() => {
  setupIPC()

  SERVICES_IDS.forEach((id, index) => {
    globalShortcut.register(`CommandOrControl+${index + 1}`, () => {
      mainWindow?.webContents.send('service:select', id)
    })
  })

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
