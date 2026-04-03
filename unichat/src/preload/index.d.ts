import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    unichat: {
      setBadge: (serviceId: string, count: number) => void
      notify: (serviceId: string, title: string, body: string) => void
      onServiceSelect: (callback: (id: string) => void) => () => void
    }
  }
}
