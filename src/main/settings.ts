import { app, safeStorage } from 'electron'
import Store from 'electron-store'
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import type { AppSettings, EngineKind } from '../shared/types'
import { DEFAULT_SETTINGS } from '../shared/defaults'

type Persisted = {
  settings: AppSettings
  // API keys stored as base64 of safeStorage-encrypted buffers.
  keys: Partial<Record<Exclude<EngineKind, 'local'>, string>>
}

// One-time migration from the TaylorMind era: the rename moved userData
// (…/TaylorMind → …/LocalMind) and the store file (taylormind.json → localmind.json).
// safeStorage (DPAPI) is per-user, so copied API keys still decrypt.
function migrateLegacyStore(): void {
  try {
    const userData = app.getPath('userData')
    const target = join(userData, 'localmind.json')
    if (existsSync(target)) return
    const appData = dirname(userData)
    const candidates = [
      join(userData, 'taylormind.json'),
      join(appData, 'TaylorMind', 'taylormind.json'),
      join(appData, 'taylormind', 'taylormind.json')
    ]
    const source = candidates.find((p) => existsSync(p))
    if (source) {
      mkdirSync(userData, { recursive: true })
      copyFileSync(source, target)
    }
  } catch {
    // Best-effort: worst case the user starts with default settings.
  }
}
migrateLegacyStore()

const store = new Store<Persisted>({
  name: 'localmind',
  defaults: { settings: DEFAULT_SETTINGS, keys: {} }
})

export function getSettings(): AppSettings {
  // Merge with defaults so new fields appear after upgrades.
  return { ...DEFAULT_SETTINGS, ...store.get('settings') }
}

export function setSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...patch }
  store.set('settings', next)
  return next
}

export function setApiKey(provider: Exclude<EngineKind, 'local'>, key: string): void {
  const keys = store.get('keys')
  if (!key) {
    delete keys[provider]
  } else if (safeStorage.isEncryptionAvailable()) {
    keys[provider] = safeStorage.encryptString(key).toString('base64')
  } else {
    // Fallback: store as-is (OS keychain unavailable). Still local-only.
    keys[provider] = 'plain:' + Buffer.from(key, 'utf8').toString('base64')
  }
  store.set('keys', keys)
}

export function getApiKey(provider: Exclude<EngineKind, 'local'>): string | undefined {
  const raw = store.get('keys')[provider]
  if (!raw) return undefined
  if (raw.startsWith('plain:')) {
    return Buffer.from(raw.slice('plain:'.length), 'base64').toString('utf8')
  }
  try {
    return safeStorage.decryptString(Buffer.from(raw, 'base64'))
  } catch {
    return undefined
  }
}

export function hasApiKey(provider: Exclude<EngineKind, 'local'>): boolean {
  return Boolean(store.get('keys')[provider])
}
