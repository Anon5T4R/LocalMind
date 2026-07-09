import { useEffect, useState } from 'react'
import { useMap } from '../store'
import { mapToMarkdown, mapToHtml, mapToPngDataUrl } from '../export'
import type { AiActions } from '../ai/useAiActions'
import type { AppSettings } from '@shared/types'

const COLORS = ['#7c5cff', '#3a8dde', '#27ae60', '#e67e22', '#e74c3c', '#e84393', '']

interface Props {
  onOpenSettings: () => void
  onOpenGenerate: () => void
  onToggleChat: () => void
  chatOpen: boolean
  ai: AiActions
}

const ENGINE_LABEL: Record<AppSettings['engine'], string> = {
  local: 'Local',
  anthropic: 'Claude',
  openai: 'OpenAI',
  gemini: 'Gemini',
  'openai-compatible': 'Compatível'
}

export function Toolbar({
  onOpenSettings,
  onOpenGenerate,
  onToggleChat,
  chatOpen,
  ai
}: Props): JSX.Element {
  const map = useMap((s) => s.map)
  const filePath = useMap((s) => s.filePath)
  const dirty = useMap((s) => s.dirty)
  const selectedId = useMap((s) => s.selectedId)
  const addChild = useMap((s) => s.addChild)
  const deleteNode = useMap((s) => s.deleteNode)
  const setColor = useMap((s) => s.setColor)
  const newMap = useMap((s) => s.newMap)
  const setMap = useMap((s) => s.setMap)
  const markSaved = useMap((s) => s.markSaved)
  const undo = useMap((s) => s.undo)
  const redo = useMap((s) => s.redo)
  // Subscribe to history length so the buttons enable/disable reactively.
  const canUndo = useMap((s) => s.past.length > 0)
  const canRedo = useMap((s) => s.future.length > 0)

  // Poll the engine + local model status so the label reflects changes made in
  // the settings dialog and shows whether a GGUF is actually loaded.
  const [engine, setEngine] = useState<AppSettings['engine']>('local')
  const [local, setLocal] = useState<{ loaded: boolean; loading: boolean }>({
    loaded: false,
    loading: false
  })
  useEffect(() => {
    let alive = true
    const tick = (): void => {
      window.localmind.getSettings().then((s) => {
        if (alive) setEngine(s.engine)
      })
      window.localmind.localEngineStatus().then((s) => {
        if (alive) setLocal({ loaded: s.loaded, loading: s.loading })
      })
    }
    tick()
    const t = setInterval(tick, 2000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])
  const localDot = engine === 'local' ? (local.loaded ? ' 🟢' : local.loading ? ' 🟡' : ' ⚪') : ''

  const handleOpen = async (): Promise<void> => {
    const res = await window.localmind.openMap()
    if (res) setMap(res.map, res.path)
  }
  const handleSave = async (): Promise<void> => {
    const saved = await window.localmind.saveMap(map, filePath ?? undefined)
    if (saved) markSaved(saved)
  }
  const handleSaveAs = async (): Promise<void> => {
    const saved = await window.localmind.saveMap(map)
    if (saved) markSaved(saved)
  }

  const [exportOpen, setExportOpen] = useState(false)
  const safeTitle = (map.title || 'mapa').replace(/[^\w\- ]+/g, '').trim() || 'mapa'
  const exportAs = async (kind: 'png' | 'md' | 'html'): Promise<void> => {
    setExportOpen(false)
    if (kind === 'png') {
      const dataUrl = mapToPngDataUrl(map)
      if (dataUrl) {
        await window.localmind.exportFile(dataUrl.split(',')[1], true, `${safeTitle}.png`, [
          { name: 'PNG', extensions: ['png'] }
        ])
      }
    } else if (kind === 'md') {
      await window.localmind.exportFile(mapToMarkdown(map), false, `${safeTitle}.md`, [
        { name: 'Markdown', extensions: ['md'] }
      ])
    } else {
      await window.localmind.exportFile(mapToHtml(map), false, `${safeTitle}.html`, [
        { name: 'HTML', extensions: ['html'] }
      ])
    }
  }

  return (
    <div className="toolbar">
      <div className="tb-group">
        <span className="brand">🧠 LocalMind</span>
      </div>

      <div className="tb-group">
        <button onClick={newMap} title="Novo mapa">Novo</button>
        <button onClick={handleOpen} title="Abrir">Abrir</button>
        <button onClick={handleSave} title="Salvar">
          Salvar{dirty ? ' •' : ''}
        </button>
        <button onClick={handleSaveAs} title="Salvar como">Salvar como…</button>
        <div className="dropdown">
          <button onClick={() => setExportOpen((v) => !v)} title="Exportar">
            Exportar ▾
          </button>
          {exportOpen && (
            <>
              <div className="dropdown-backdrop" onClick={() => setExportOpen(false)} />
              <div className="dropdown-menu">
                <button onClick={() => exportAs('png')}>🖼 Imagem (PNG)</button>
                <button onClick={() => exportAs('md')}>📄 Markdown (.md)</button>
                <button onClick={() => exportAs('html')}>🌐 HTML (.html)</button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="tb-group">
        <button disabled={!canUndo} onClick={undo} title="Desfazer (Ctrl+Z)">↶</button>
        <button disabled={!canRedo} onClick={redo} title="Refazer (Ctrl+Shift+Z)">↷</button>
      </div>

      <div className="tb-group">
        <button disabled={!selectedId} onClick={() => selectedId && addChild(selectedId)}>
          + Filho
        </button>
        <button disabled={!selectedId} onClick={() => selectedId && deleteNode(selectedId)}>
          Excluir
        </button>
        <div className="swatches">
          {COLORS.map((c) => (
            <button
              key={c || 'none'}
              className={`swatch${c ? '' : ' none'}`}
              style={c ? { background: c } : undefined}
              title={c || 'Sem cor'}
              disabled={!selectedId}
              onClick={() => selectedId && setColor(selectedId, c || undefined)}
            />
          ))}
        </div>
      </div>

      <div className="tb-group ai">
        <button className="primary" onClick={onOpenGenerate} disabled={ai.busy}>
          ✨ Gerar mapa
        </button>
        <button
          disabled={!selectedId || ai.busy}
          onClick={() => selectedId && ai.expandNode(selectedId)}
          title="Gerar subtópicos com IA"
        >
          Expandir nó
        </button>
        <button
          className={chatOpen ? 'active' : ''}
          onClick={onToggleChat}
          title="Abrir/fechar chat com a IA"
        >
          💬 Chat
        </button>
      </div>

      <div className="tb-spacer" />

      <div className="tb-group">
        <button
          className="help"
          title={
            'Atalhos:\n' +
            'Tab = novo filho\n' +
            'Enter = novo irmão\n' +
            'F2 = editar  ·  duplo-clique = editar\n' +
            'Delete = excluir\n' +
            'Espaço = recolher/expandir\n' +
            '↑ ↓ ← → = navegar entre nós\n' +
            'Alt+↑ / Alt+↓ = reordenar irmãos\n' +
            'Alt+→ = indentar  ·  Alt+← = desindentar\n' +
            'Ctrl+Z / Ctrl+Shift+Z = desfazer/refazer'
          }
        >
          ?
        </button>
      </div>

      <div className="tb-group">
        <button
          className="engine"
          onClick={onOpenSettings}
          title={
            engine === 'local'
              ? local.loaded
                ? 'Modelo local carregado'
                : local.loading
                  ? 'Carregando modelo local…'
                  : 'Modelo local não carregado (carrega na 1ª geração)'
              : 'Configurações'
          }
        >
          ⚙ {ENGINE_LABEL[engine]}
          {localDot}
        </button>
      </div>

      {ai.error && (
        <div className="tb-error" onClick={ai.clearError} title="Clique para fechar">
          ⚠ {ai.error}
        </div>
      )}
    </div>
  )
}
