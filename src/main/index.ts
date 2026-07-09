import { app, shell, BrowserWindow, ipcMain, nativeImage } from 'electron'
import { join } from 'path'
import type { AppSettings, EngineKind, GenerateRequest, MindMap } from '../shared/types'
import {
  getSettings,
  setSettings,
  setApiKey,
  hasApiKey
} from './settings'
import { listLocalModels, pickModelFile } from './models'
import { openMap, openMapFromPath, saveMap, exportFile } from './persistence'
import {
  runGenerate,
  cancelGenerate,
  localEngineStatus,
  loadLocalModel,
  unloadLocalModel
} from './ai'

let mainWindow: BrowserWindow | null = null

function getTmindArgv(argv: string[]): string | null {
  // In packaged apps argv[0] is the exe; in dev argv[0] is electron, argv[1] is the script.
  // The file path is always the last argument that ends with .tmind.
  for (let i = argv.length - 1; i >= 0; i--) {
    if (argv[i].toLowerCase().endsWith('.tmind')) return argv[i]
  }
  return null
}

function sendOpenFile(filePath: string): void {
  if (!mainWindow) return
  openMapFromPath(filePath)
    .then((result) => mainWindow?.webContents.send('map:open-file', result))
    .catch(() => {/* ignore bad file */})
}

function createWindow(initialFile?: string | null): void {
  const iconPath = join(__dirname, '../../build/icon.ico')
  const icon = nativeImage.createFromPath(iconPath)

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0f1115',
    title: 'LocalMind',
    autoHideMenuBar: true,
    icon: icon.isEmpty() ? undefined : icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    if (initialFile) sendOpenFile(initialFile)
  })

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

// Single-instance: if another instance tries to open, redirect here and focus.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      const filePath = getTmindArgv(argv)
      if (filePath) sendOpenFile(filePath)
    }
  })

  app.whenReady().then(() => {
    registerIpc()
    const initialFile = getTmindArgv(process.argv)
    createWindow(initialFile)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
