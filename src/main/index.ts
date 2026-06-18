import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import type { AppSettings, EngineKind, GenerateRequest, MindMap } from '../shared/types'
import {
  getSettings,
  setSettings,
  setApiKey,
  hasApiKey
} from './settings'
import { listLocalModels, pickModelFile } from './models'
import { openMap, saveMap, exportFile } from './persistence'
import {
  runGenerate,
  cancelGenerate,
  localEngineStatus,
  loadLocalModel,
  unloadLocalModel
} from './ai'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0f1115',
    title: 'TaylorMind',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // electron-vite injects the dev server URL in development.
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:set', (_e, patch: Partial<AppSettings>) => setSettings(patch))

  ipcMain.handle('keys:set', (_e, provider: Exclude<EngineKind, 'local'>, key: string) =>
    setApiKey(provider, key)
  )
  ipcMain.handle('keys:has', (_e, provider: Exclude<EngineKind, 'local'>) => hasApiKey(provider))

  ipcMain.handle('models:list', () => listLocalModels())
  ipcMain.handle('models:pick', () => pickModelFile())

  ipcMain.handle('map:open', () => openMap())
  ipcMain.handle('map:save', (_e, map: MindMap, path?: string) => saveMap(map, path))
  ipcMain.handle(
    'export:file',
    (
      _e,
      data: string,
      base64: boolean,
      defaultName: string,
      filters: { name: string; extensions: string[] }[]
    ) => exportFile(data, base64, defaultName, filters)
  )

  ipcMain.handle('ai:status', () => localEngineStatus())
  ipcMain.handle('ai:load', () =>
    loadLocalModel((channel, payload) => mainWindow?.webContents.send(channel, payload))
  )
  ipcMain.handle('ai:unload', () => unloadLocalModel())
  ipcMain.handle('ai:cancel', (_e, requestId: string) => cancelGenerate(requestId))
  ipcMain.handle('ai:generate', (_e, req: GenerateRequest) => {
    // Fire and forget; results stream via webContents events.
    void runGenerate(req, (channel, payload) => {
      mainWindow?.webContents.send(channel, payload)
    })
  })
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
