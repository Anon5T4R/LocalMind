import type { LocalMindApi } from '../shared/types'

declare global {
  interface Window {
    localmind: LocalMindApi
  }
}

export {}
