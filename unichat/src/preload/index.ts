import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('unichat', {
  setBadge: (serviceId: string, count: number) =>
    ipcRenderer.send('badge:update', { serviceId, count }),

  notify: (serviceId: string, title: string, body: string) => {
    const safeTitle = String(title).slice(0, 100)
    const safeBody = String(body).slice(0, 300)
    ipcRenderer.send('notification:show', { serviceId, title: safeTitle, body: safeBody })
  },

  onServiceSelect: (callback: (id: string) => void) =>
    ipcRenderer.on('service:select', (_event, id) => callback(id)),
})

declare global {
  interface Window {
    unichat: {
      setBadge: (serviceId: string, count: number) => void
      notify: (serviceId: string, title: string, body: string) => void
      onServiceSelect: (callback: (id: string) => void) => void
    }
  }
}
