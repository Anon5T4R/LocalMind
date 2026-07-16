import { useEffect, useState } from 'react'
import { useMap } from '../store'
import { mapToMarkdown, mapToHtml, mapToPngDataUrl } from '../export'
import type { AiActions } from '../ai/useAiActions'
import type { AppSettings } from '@shared/types'
import { t } from '../lib/i18n'

const COLORS = ['#7c5cff', '#3a8dde', '#27ae60', '#e67e22', '#e74c3c', '#e84393', '']

interface Props {
  onOpenSettings: () => void
  onOpenGenerate: () => void
  onToggleChat: () => void
  chatOpen: boolean
  ai: AiActions
}

// Provider/brand names are NOT translated; only the "compatible" label word is.
const engineLabel = (engine: AppSettings['engine']): string =>
  engine === 'local'
    ? 'Local'
    : engine === 'anthropic'
      ? 'Claude'
      : engine === 'openai'
        ? 'OpenAI'
        : engine === 'gemini'
          ? 'Gemini'
          : t('engine.compat')

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
  const fallbackTitle = t('export.defaultTitle')
  const safeTitle = (map.title || fallbackTitle).replace(/[^\w\- ]+/g, '').trim() || fallbackTitle
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
        <button onClick={newMap} title={t('tb.new.title')}>{t('tb.new')}</button>
        <button onClick={handleOpen} title={t('tb.open.title')}>{t('tb.open')}</button>
        <button onClick={handleSave} title={t('tb.save.title')}>
          {t('tb.save')}{dirty ? ' •' : ''}
        </button>
        <button onClick={handleSaveAs} title={t('tb.saveAs.title')}>{t('tb.saveAs')}</button>
        <div className="dropdown">
          <button onClick={() => setExportOpen((v) => !v)} title={t('tb.export.title')}>
            {t('tb.export')} ▾
          </button>
          {exportOpen && (
            <>
              <div className="dropdown-backdrop" onClick={() => setExportOpen(false)} />
              <div className="dropdown-menu">
                <button onClick={() => exportAs('png')}>🖼 {t('tb.export.png')}</button>
                <button onClick={() => exportAs('md')}>📄 Markdown (.md)</button>
                <button onClick={() => exportAs('html')}>🌐 HTML (.html)</button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="tb-group">
        <button disabled={!canUndo} onClick={undo} title={t('tb.undo.title')}>↶</button>
        <button disabled={!canRedo} onClick={redo} title={t('tb.redo.title')}>↷</button>
      </div>

      <div className="tb-group">
        <button disabled={!selectedId} onClick={() => selectedId && addChild(selectedId)}>
          {t('tb.addChild')}
        </button>
        <button disabled={!selectedId} onClick={() => selectedId && deleteNode(selectedId)}>
          {t('common.delete')}
        </button>
        <div className="swatches">
          {COLORS.map((c) => (
            <button
              key={c || 'none'}
              className={`swatch${c ? '' : ' none'}`}
              style={c ? { background: c } : undefined}
              title={c || t('common.noColor')}
              disabled={!selectedId}
              onClick={() => selectedId && setColor(selectedId, c || undefined)}
            />
          ))}
        </div>
      </div>

      <div className="tb-group ai">
        <button className="primary" onClick={onOpenGenerate} disabled={ai.busy}>
          ✨ {t('tb.generate')}
        </button>
        <button
          disabled={!selectedId || ai.busy}
          onClick={() => selectedId && ai.expandNode(selectedId)}
          title={t('tb.expand.title')}
        >
          {t('tb.expand')}
        </button>
        <button
          className={chatOpen ? 'active' : ''}
          onClick={onToggleChat}
          title={t('tb.chat.title')}
        >
          💬 {t('tb.chat')}
        </button>
      </div>

      <div className="tb-spacer" />

      <div className="tb-group">
        <button className="help" title={t('tb.help')}>
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
                ? t('tb.engine.loaded')
                : local.loading
                  ? t('tb.engine.loading')
                  : t('tb.engine.notLoaded')
              : t('settings.title')
          }
        >
          ⚙ {engineLabel(engine)}
          {localDot}
        </button>
      </div>

      {ai.error && (
        <div className="tb-error" onClick={ai.clearError} title={t('tb.error.title')}>
          ⚠ {ai.error}
        </div>
      )}
    </div>
  )
}
