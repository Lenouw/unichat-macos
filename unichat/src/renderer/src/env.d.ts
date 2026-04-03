/// <reference types="vite/client" />

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
