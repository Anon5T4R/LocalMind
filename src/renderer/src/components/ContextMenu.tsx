import { useEffect, useRef } from 'react'
import { useMap } from '../store'
import type { AiActions } from '../ai/useAiActions'
import { t } from '../lib/i18n'

const COLORS = ['#7c5cff', '#3a8dde', '#27ae60', '#e67e22', '#e74c3c', '#e84393']
const BASE_FONT = 13.5

export interface MenuState {
  x: number
  y: number
  nodeId: string
}

interface Props {
  menu: MenuState
  ai: AiActions
  onAskAI: (nodeId: string) => void
  onClose: () => void
}

export function ContextMenu({ menu, ai, onAskAI, onClose }: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const node = useMap((s) => s.getNode(menu.nodeId))
  const rootId = useMap((s) => s.rootId())
  const setEditing = useMap((s) => s.setEditing)
  const addChild = useMap((s) => s.addChild)
  const addSibling = useMap((s) => s.addSibling)
  const toggleCollapse = useMap((s) => s.toggleCollapse)
  const deleteNode = useMap((s) => s.deleteNode)
  const setColor = useMap((s) => s.setColor)
  const setSide = useMap((s) => s.setSide)
  const setFontSize = useMap((s) => s.setFontSize)
  const setWidth = useMap((s) => s.setWidth)
  const childCount = useMap((s) => s.childrenOf(menu.nodeId).length)

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onEsc)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onEsc)
    }
  }, [onClose])

  if (!node) return <></>
  const isRoot = node.parentId === null
  const isRootChild = node.parentId === rootId
  const id = node.id
  const act = (fn: () => void) => () => {
    fn()
    onClose()
  }
  const bumpFont = (delta: number): void => {
    const cur = node.fontSize ?? BASE_FONT
    setFontSize(id, Math.max(9, Math.min(34, cur + delta)))
  }

  // Keep the menu on screen.
  const style: React.CSSProperties = {
    left: Math.min(menu.x, window.innerWidth - 220),
    top: Math.min(menu.y, window.innerHeight - 360)
  }

  return (
    <div className="ctx-menu" ref={ref} style={style}>
      <button onClick={act(() => setEditing(id))}>✏️ {t('ctx.edit')}</button>
      <button onClick={act(() => addChild(id))}>＋ {t('ctx.addChild')}</button>
      {!isRoot && <button onClick={act(() => addSibling(id))}>↳ {t('ctx.addSibling')}</button>}
      <button disabled={ai.busy} onClick={act(() => ai.expandNode(id))}>
        ✨ {t('ctx.expandAi')}
      </button>
      <button disabled={ai.busy} onClick={act(() => ai.deepExpandNode(id))}>
        🌳 {t('ctx.deepExpand')}
      </button>
      <button disabled={ai.busy} onClick={act(() => ai.explainNode(id))}>
        🧠 {t('ctx.explain')}
      </button>
      <button disabled={ai.busy} onClick={act(() => onAskAI(id))}>
        💬 {t('ctx.askAi')}
      </button>
      {childCount > 0 && (
        <button onClick={act(() => toggleCollapse(id))}>
          {node.collapsed ? `▸ ${t('ctx.expandBranch')}` : `▾ ${t('ctx.collapseBranch')}`}
        </button>
      )}

      {isRootChild && (
        <>
          <div className="ctx-sep" />
          <div className="ctx-row">
            <span className="ctx-label">{t('ctx.side')}</span>
            <button className="mini" title={t('ctx.side.left')} onClick={act(() => setSide(id, 'left'))}>⬅</button>
            <button className="mini" title={t('ctx.side.right')} onClick={act(() => setSide(id, 'right'))}>➡</button>
            <button className="mini" title={t('ctx.side.up')} onClick={act(() => setSide(id, 'up'))}>⬆</button>
            <button className="mini" title={t('ctx.side.down')} onClick={act(() => setSide(id, 'down'))}>⬇</button>
          </div>
        </>
      )}

      <div className="ctx-sep" />
      <div className="ctx-row">
        <span className="ctx-label">{t('ctx.font')}</span>
        <button className="mini" onClick={() => bumpFont(-2)}>A−</button>
        <button className="mini" onClick={() => bumpFont(2)}>A+</button>
        <button className="mini" onClick={() => setWidth(id, undefined)} title={t('ctx.widthReset')}>
          ↔ reset
        </button>
      </div>

      <div className="ctx-row swatches">
        <span className="ctx-label">{t('ctx.color')}</span>
        {COLORS.map((c) => (
          <button
            key={c}
            className="swatch"
            style={{ background: c }}
            onClick={act(() => setColor(id, c))}
          />
        ))}
        <button className="swatch none" title={t('common.noColor')} onClick={act(() => setColor(id, undefined))} />
      </div>

      {!isRoot && (
        <>
          <div className="ctx-sep" />
          <button className="danger" onClick={act(() => deleteNode(id))}>
            🗑 {t('common.delete')}
          </button>
        </>
      )}
    </div>
  )
}
