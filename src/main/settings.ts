import { safeStorage } from 'electron'
import Store from 'electron-store'
import type { AppSettings, EngineKind } from '../shared/types'
import { DEFAULT_SETTINGS } from '../shared/defaults'

type Persisted = {
  settings: AppSettings
  // API keys stored as base64 of safeStorage-encrypted buffers.
  keys: Partial<Record<Exclude<EngineKind, 'local'>, string>>
}

const store = new Store<Persisted>({
  name: 'taylormind',
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
