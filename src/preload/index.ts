import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  EngineKind,
  GenerateRequest,
  LoadProgress,
  MindMap,
  StreamChunk,
  StreamDone,
  TaylorMindApi
} from '../shared/types'

const api: TaylorMindApi = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: Partial<AppSettings>) => ipcRenderer.invoke('settings:set', patch),

  setApiKey: (provider, key) => ipcRenderer.invoke('keys:set', provider, key),
  hasApiKey: (provider) => ipcRenderer.invoke('keys:has', provider),

  listLocalModels: () => ipcRenderer.invoke('models:list'),
  pickModelFile: () => ipcRenderer.invoke('models:pick'),

  openMap: () => ipcRenderer.invoke('map:open'),
  saveMap: (map: MindMap, path?: string) => ipcRenderer.invoke('map:save', map, path),
  exportFile: (data, base64, defaultName, filters) =>
    ipcRenderer.invoke('export:file', data, base64, defaultName, filters),

  generate: (req: GenerateRequest) => ipcRenderer.invoke('ai:generate', req),
  cancel: (requestId: string) => ipcRenderer.invoke('ai:cancel', requestId),

  onChunk: (cb: (chunk: StreamChunk) => void) => {
    const handler = (_e: unknown, payload: StreamChunk): void => cb(payload)
    ipcRenderer.on('ai:chunk', handler)
    return () => ipcRenderer.removeListener('ai:chunk', handler)
  },
  onDone: (cb: (done: StreamDone) => void) => {
    const handler = (_e: unknown, payload: StreamDone): void => cb(payload)
    ipcRenderer.on('ai:done', handler)
    return () => ipcRenderer.removeListener('ai:done', handler)
  },
  onLoadProgress: (cb: (p: LoadProgress) => void) => {
    const handler = (_e: unknown, payload: LoadProgress): void => cb(payload)
    ipcRenderer.on('ai:loadprogress', handler)
    return () => ipcRenderer.removeListener('ai:loadprogress', handler)
  },

  onOpenFile: (cb: (result: { path: string; map: MindMap }) => void) => {
    const handler = (_e: unknown, payload: { path: string; map: MindMap }): void => cb(payload)
    ipcRenderer.on('map:open-file', handler)
    return () => ipcRenderer.removeListener('map:open-file', handler)
  },

  localEngineStatus: () => ipcRenderer.invoke('ai:status') as ReturnType<
    TaylorMindApi['localEngineStatus']
  >,
  loadLocalModel: () => ipcRenderer.invoke('ai:load') as ReturnType<
    TaylorMindApi['loadLocalModel']
  >,
  unloadLocalModel: () => ipcRenderer.invoke('ai:unload') as ReturnType<
    TaylorMindApi['unloadLocalModel']
  >
}

contextBridge.exposeInMainWorld('taylormind', api)
