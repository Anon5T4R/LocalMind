import { memo, useEffect, useRef, useState } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useMap } from '../store'
import { NODE_W, type Side } from '../layout'
import { t } from '../lib/i18n'

export interface MindNodeData {
  text: string
  color?: string
  collapsed?: boolean
  hasChildren: boolean
  childCount: number
  isRoot: boolean
  note?: string
  width?: number
  fontSize?: number
  side: Side
  [key: string]: unknown
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function MindNodeViewImpl({ id, data, selected }: NodeProps) {
  const d = data as MindNodeData
  const updateText = useMap((s) => s.updateText)
  const toggleCollapse = useMap((s) => s.toggleCollapse)
  const setWidth = useMap((s) => s.setWidth)
  const addChild = useMap((s) => s.addChild)
  const editingId = useMap((s) => s.editingId)
  const setEditingId = useMap((s) => s.setEditing)
  const { getZoom } = useReactFlow()

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(d.text)
  const [dragW, setDragW] = useState<number | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editingId === id && !editing) {
      setDraft(d.text)
      setEditing(true)
    }
  }, [editingId, id, editing, d.text])

  useEffect(() => {
    if (!editing) setDraft(d.text)
  }, [d.text, editing])

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus()
      ref.current.select()
    }
  }, [editing])

  // Auto-grow the editing textarea to fit its content.
  useEffect(() => {
    const el = ref.current
    if (editing && el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [editing, draft])

  const commit = (): void => {
    setEditing(false)
    if (editingId === id) setEditingId(null)
    const next = draft.trim()
    if (next && next !== d.text) updateText(id, next)
    else setDraft(d.text)
  }

  const startResize = (e: React.PointerEvent): void => {
    e.stopPropagation()
    e.preventDefault()
    const startX = e.clientX
    const startW = d.width ?? NODE_W
    const zoom = getZoom() || 1
    let last = startW
    const onMove = (ev: PointerEvent): void => {
      last = clamp(startW + (ev.clientX - startX) / zoom, 120, 640)
      setDragW(last)
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setDragW(null)
      setWidth(id, Math.round(last))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Cor do nó: a escolhida pelo usuário; sem cor, segue o tema (accent na raiz,
  // accent-2 nos demais). Override por elemento de --accent — nunca com
  // var(--accent) (auto-referência é ciclo em custom property), por isso a raiz
  // sem cor simplesmente herda o valor do :root.
  const accentOverride = d.color || (d.isRoot ? null : 'var(--accent-2)')
  const width = dragW ?? d.width ?? NODE_W
  const collapseLeft = d.side === 'left'

  return (
    <div
      className={`mind-node${selected ? ' selected' : ''}${d.isRoot ? ' root' : ''}`}
      style={{
        width,
        borderColor: selected ? 'var(--accent)' : 'transparent',
        ...(accentOverride ? { ['--accent' as string]: accentOverride } : {})
      }}
      onDoubleClick={() => setEditing(true)}
    >
      {/* Handles depend on which direction from the root this node lives. */}
      {d.isRoot ? (
        <>
          <Handle id="sl" type="source" position={Position.Left} className="mn-handle" />
          <Handle id="sr" type="source" position={Position.Right} className="mn-handle" />
          <Handle id="st" type="source" position={Position.Top} className="mn-handle" />
          <Handle id="sb" type="source" position={Position.Bottom} className="mn-handle" />
        </>
      ) : d.side === 'left' ? (
        <>
          <Handle id="tr" type="target" position={Position.Right} className="mn-handle" />
          <Handle id="sl" type="source" position={Position.Left} className="mn-handle" />
        </>
      ) : d.side === 'up' ? (
        <>
          <Handle id="tb" type="target" position={Position.Bottom} className="mn-handle" />
          <Handle id="st" type="source" position={Position.Top} className="mn-handle" />
        </>
      ) : d.side === 'down' ? (
        <>
          <Handle id="tt" type="target" position={Position.Top} className="mn-handle" />
          <Handle id="sb" type="source" position={Position.Bottom} className="mn-handle" />
        </>
      ) : (
        <>
          <Handle id="tl" type="target" position={Position.Left} className="mn-handle" />
          <Handle id="sr" type="source" position={Position.Right} className="mn-handle" />
        </>
      )}

      {/* Directional "add child" buttons on the central node. */}
      {d.isRoot && (
        <>
          <button
            className="mn-add up"
            title={t('node.branchUp')}
            onClick={(e) => {
              e.stopPropagation()
              addChild(id, t('node.new'), true, 'up')
            }}
          >
            +
          </button>
          <button
            className="mn-add down"
            title={t('node.branchDown')}
            onClick={(e) => {
              e.stopPropagation()
              addChild(id, t('node.new'), true, 'down')
            }}
          >
            +
          </button>
          <button
            className="mn-add left"
            title={t('node.branchLeft')}
            onClick={(e) => {
              e.stopPropagation()
              addChild(id, t('node.new'), true, 'left')
            }}
          >
            +
          </button>
          <button
            className="mn-add right"
            title={t('node.branchRight')}
            onClick={(e) => {
              e.stopPropagation()
              addChild(id, t('node.new'), true, 'right')
            }}
          >
            +
          </button>
        </>
      )}

      <span className="mn-bar" style={{ background: 'var(--accent)' }} />

      {editing ? (
        <textarea
          ref={ref}
          className="mn-input"
          value={draft}
          rows={1}
          style={d.fontSize ? { fontSize: d.fontSize } : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              commit()
            } else if (e.key === 'Escape') {
              setEditing(false)
              if (editingId === id) setEditingId(null)
              setDraft(d.text)
            }
            e.stopPropagation()
          }}
        />
      ) : (
        <span className="mn-text" style={d.fontSize ? { fontSize: d.fontSize } : undefined}>
          {d.text}
        </span>
      )}

      {d.note ? <span className="mn-note-dot" title={d.note} /> : null}

      {d.hasChildren && (
        <button
          className={`mn-collapse${collapseLeft ? ' left' : ''}`}
          title={d.collapsed ? t('node.expand') : t('node.collapse')}
          onClick={(e) => {
            e.stopPropagation()
            toggleCollapse(id)
          }}
        >
          {d.collapsed ? `+${d.childCount}` : '–'}
        </button>
      )}

      {selected && (
        <span
          className="mn-resize"
          title={t('node.resize')}
          onPointerDown={startResize}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  )
}

export const MindNodeView = memo(MindNodeViewImpl)
