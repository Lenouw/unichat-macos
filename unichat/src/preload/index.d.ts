import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    unichat: {
      setBadge: (serviceId: string, count: number) => void
      notify: (serviceId: string, title: string, body: string) => void
      onServiceSelect: (callback: (id: string) => void) => () => void
      registerAccounts: (ids: string[], partitions: string[]) => void
      clearSession: (partition: string) => void
      getCacheSize: () => Promise<number>
      purgeCache: () => Promise<number>
      onUpdateStatus: (callback: (event: string, payload?: string) => void) => () => void
      installUpdate: () => void
      openExternal: (url: string) => void
    }
  }
}
