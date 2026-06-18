import type { TaylorMindApi } from '../shared/types'

declare global {
  interface Window {
    taylormind: TaylorMindApi
  }
}

export {}
