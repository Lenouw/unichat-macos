import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('unichat', {
  setBadge: (serviceId: string, count: number) =>
    ipcRenderer.send('badge:update', { serviceId, count }),

  notify: (serviceId: string, title: string, body: string) => {
    const safeTitle = String(title).slice(0, 100)
    const safeBody = String(body).slice(0, 300)
    ipcRenderer.send('notification:show', { serviceId, title: safeTitle, body: safeBody })
  },

  onServiceSelect: (callback: (id: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, id: string) => callback(id)
    ipcRenderer.on('service:select', listener)
    return () => ipcRenderer.removeListener('service:select', listener)
  },

  registerAccounts: (ids: string[], partitions: string[]) => {
    ipcRenderer.send('accounts:register', { ids, partitions })
  },

  onUpdateStatus: (callback: (event: string, payload?: string) => void) => {
    const handlers: Array<[string, (...args: unknown[]) => void]> = [
      ['update:checking',     () => callback('checking')],
      ['update:available',    (_e: unknown, v: unknown) => callback('available', String(v))],
      ['update:not-available',() => callback('not-available')],
      ['update:progress',     (_e: unknown, p: unknown) => callback('progress', String(p))],
      ['update:ready',        (_e: unknown, v: unknown) => callback('ready', String(v))],
    ]
    handlers.forEach(([ch, fn]) => ipcRenderer.on(ch, fn))
    return () => handlers.forEach(([ch, fn]) => ipcRenderer.removeListener(ch, fn))
  },

  installUpdate: () => {
    ipcRenderer.send('update:install')
  },

  openExternal: (url: string) => {
    ipcRenderer.send('open:external', url)
  },
})
