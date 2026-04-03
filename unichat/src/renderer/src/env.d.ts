/// <reference types="vite/client" />

declare const __APP_VERSION__: string | undefined

declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      src?: string
      partition?: string
      useragent?: string
      allowpopups?: boolean
      disablewebsecurity?: string
      ref?: React.RefObject<Electron.WebviewTag | null>
    }
  }
}
