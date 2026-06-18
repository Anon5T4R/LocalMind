import { promises as fs } from 'fs'
import { join, basename } from 'path'
import { dialog } from 'electron'
import type { LocalModelInfo } from '../shared/types'
import { DEFAULT_MODEL_DIRS } from '../shared/defaults'

const SIDECAR_HINTS = ['mmproj', 'embed', 'embedding']

function isSidecar(name: string): boolean {
  const lower = name.toLowerCase()
  return SIDECAR_HINTS.some((h) => lower.includes(h))
}

async function walk(dir: string, out: string[], depth = 0): Promise<void> {
  if (depth > 6) return
  let entries: import('fs').Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      await walk(full, out, depth + 1)
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.gguf')) {
      out.push(full)
    }
  }
}

export async function listLocalModels(): Promise<LocalModelInfo[]> {
  const files: string[] = []
  for (const dir of DEFAULT_MODEL_DIRS) {
    await walk(dir, files)
  }
  const infos = await Promise.all(
    files.map(async (path): Promise<LocalModelInfo> => {
      let sizeBytes = 0
      try {
        sizeBytes = (await fs.stat(path)).size
      } catch {
        /* ignore */
      }
      const name = basename(path)
      return { path, name, sizeBytes, isSidecar: isSidecar(name) }
    })
  )
  // Chat models first, then by size descending.
  return infos.sort((a, b) => {
    if (a.isSidecar !== b.isSidecar) return a.isSidecar ? 1 : -1
    return b.sizeBytes - a.sizeBytes
  })
}

export async function pickModelFile(): Promise<string | null> {
  const res = await dialog.showOpenDialog({
    title: 'Selecionar modelo GGUF',
    properties: ['openFile'],
    filters: [{ name: 'GGUF models', extensions: ['gguf'] }],
    defaultPath: DEFAULT_MODEL_DIRS[0]
  })
  if (res.canceled || res.filePaths.length === 0) return null
  return res.filePaths[0]
}
