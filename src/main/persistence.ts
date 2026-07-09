import { promises as fs } from 'fs'
import { dialog } from 'electron'
import type { MindMap } from '../shared/types'

export async function openMapFromPath(path: string): Promise<{ path: string; map: MindMap }> {
  const raw = await fs.readFile(path, 'utf8')
  const map = JSON.parse(raw) as MindMap
  return { path, map }
}

export async function openMap(): Promise<{ path: string; map: MindMap } | null> {
  const res = await dialog.showOpenDialog({
    title: 'Abrir mapa',
    properties: ['openFile'],
    filters: [
      { name: 'LocalMind', extensions: ['tmind', 'json'] },
      { name: 'Todos', extensions: ['*'] }
    ]
  })
  if (res.canceled || res.filePaths.length === 0) return null
  const path = res.filePaths[0]
  try {
    const raw = await fs.readFile(path, 'utf8')
    const map = JSON.parse(raw) as MindMap
    return { path, map }
  } catch {
    dialog.showErrorBox('Arquivo inválido', `Não foi possível abrir "${path}" como mapa mental.`)
    return null
  }
}

export async function exportFile(
  data: string,
  base64: boolean,
  defaultName: string,
  filters: { name: string; extensions: string[] }[]
): Promise<string | null> {
  const res = await dialog.showSaveDialog({ title: 'Exportar', defaultPath: defaultName, filters })
  if (res.canceled || !res.filePath) return null
  if (base64) {
    await fs.writeFile(res.filePath, Buffer.from(data, 'base64'))
  } else {
    await fs.writeFile(res.filePath, data, 'utf8')
  }
  return res.filePath
}

export async function saveMap(map: MindMap, path?: string): Promise<string | null> {
  let target = path
  if (!target) {
    const res = await dialog.showSaveDialog({
      title: 'Salvar mapa',
      defaultPath: `${map.title || 'mapa'}.tmind`,
      filters: [{ name: 'LocalMind', extensions: ['tmind'] }]
    })
    if (res.canceled || !res.filePath) return null
    target = res.filePath
  }
  await fs.writeFile(target, JSON.stringify(map, null, 2), 'utf8')
  return target
}
