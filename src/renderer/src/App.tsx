import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useMap } from './store'
import { layoutTree, hiddenIds } from './layout'
import { MindNodeView, type MindNodeData } from './components/MindNodeView'
import { Toolbar } from './components/Toolbar'
import { SettingsDialog } from './components/SettingsDialog'
import { GeneratePanel } from './components/GeneratePanel'
import { ContextMenu, type MenuState } from './components/ContextMenu'
import { AskAiModal } from './components/AskAiModal'
import { ChatPanel } from './components/ChatPanel'
import { useAiActions } from './ai/useAiActions'

const nodeTypes = { mind: MindNodeView }

function Canvas(): JSX.Element {
  const map = useMap((s) => s.map)
  const selectedId = useMap((s) => s.selectedId)
  const select = useMap((s) => s.select)

  const { fitView } = useReactFlow()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [askAiNode, setAskAiNode] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const ai = useAiActions()

  const childCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of map.nodes) {
      if (n.parentId) counts.set(n.parentId, (counts.get(n.parentId) ?? 0) + 1)
    }
    return counts
  }, [map.nodes])

  const { rfNodes, rfEdges } = useMemo(() => {
    const hidden = hiddenIds(map.nodes)
    const { positions, sides } = layoutTree(map.nodes)
    const visible = map.nodes.filter((n) => !hidden.has(n.id))

    const rfNodes: Node<MindNodeData>[] = visible.map((n) => {
      const pos = positions.get(n.id) ?? { x: 0, y: 0 }
      const count = childCounts.get(n.id) ?? 0
      return {
        id: n.id,
        type: 'mind',
        position: { x: pos.x, y: pos.y },
        selected: n.id === selectedId,
        data: {
          text: n.text,
          color: n.color,
          collapsed: n.collapsed,
          hasChildren: count > 0,
          childCount: count,
          isRoot: n.parentId === null,
          note: n.note,
          width: n.width,
          fontSize: n.fontSize,
          side: sides.get(n.id) ?? 'right'
        }
      }
    })

    const rfEdges: Edge[] = visible
      .filter((n) => n.parentId && !hidden.has(n.parentId))
      .map((n) => {
        const side = sides.get(n.id)
        const handles =
          side === 'left'
            ? { sourceHandle: 'sl', targetHandle: 'tr' }
            : side === 'up'
              ? { sourceHandle: 'st', targetHandle: 'tb' }
              : side === 'down'
                ? { sourceHandle: 'sb', targetHandle: 'tt' }
                : { sourceHandle: 'sr', targetHandle: 'tl' }
        return {
          id: `${n.parentId}-${n.id}`,
          source: n.parentId as string,
          target: n.id,
          ...handles,
          type: 'smoothstep',
          animated: false
        }
      })

    return { rfNodes, rfEdges }
  }, [map.nodes, selectedId, childCounts])

  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => select(node.id), [select])

  const onNodeContextMenu: NodeMouseHandler = useCallback(
    (e, node) => {
      e.preventDefault()
      select(node.id)
      setMenu({ x: e.clientX, y: e.clientY, nodeId: node.id })
    },
    [select]
  )

  // Keyboard shortcuts. Mount-once; reads fresh state via getState to avoid stale closures.
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const navigate = (s: ReturnType<typeof useMap.getState>, key: string): void => {
      const sel = s.selectedId
      if (!sel) return
      const node = s.getNode(sel)
      if (!node) return
      if (key === 'ArrowLeft') {
        if (node.parentId) s.select(node.parentId)
      } else if (key === 'ArrowRight') {
        const kids = s.childrenOf(sel)
        if (kids.length === 0) return
        if (node.collapsed) s.toggleCollapse(sel)
        else s.select(kids[0].id)
      } else if (key === 'ArrowUp' || key === 'ArrowDown') {
        const sibs = s.childrenOf(node.parentId)
        const pos = sibs.findIndex((n) => n.id === sel)
        const next = key === 'ArrowUp' ? sibs[pos - 1] : sibs[pos + 1]
        if (next) s.select(next.id)
      }
    }

    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) return
      const s = useMap.getState()
      const mod = e.ctrlKey || e.metaKey
      const k = e.key

      // Undo / redo (work without a selection).
      if (mod && k.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        s.undo()
        return
      }
      if (mod && (k.toLowerCase() === 'y' || (k.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        s.redo()
        return
      }

      const sel = s.selectedId
      if (!sel) return

      if (e.altKey && k.startsWith('Arrow')) {
        e.preventDefault()
        if (k === 'ArrowUp') s.moveUp(sel)
        else if (k === 'ArrowDown') s.moveDown(sel)
        else if (k === 'ArrowRight') s.indent(sel)
        else if (k === 'ArrowLeft') s.outdent(sel)
        return
      }

      if (k === 'F2') {
        e.preventDefault()
        s.setEditing(sel)
      } else if (k === 'Tab') {
        e.preventDefault()
        s.addChild(sel)
      } else if (k === 'Enter') {
        e.preventDefault()
        s.addSibling(sel)
      } else if (k === 'Delete') {
        e.preventDefault()
        s.deleteNode(sel)
      } else if (k === ' ') {
        e.preventDefault()
        s.toggleCollapse(sel)
      } else if (k.startsWith('Arrow')) {
        e.preventDefault()
        navigate(s, k)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Open file passed via OS file association (double-click or second-instance).
  const setMap = useMap((s) => s.setMap)
  useEffect(() => {
    return window.taylormind.onOpenFile(({ path, map }) => setMap(map, path))
  }, [setMap])

  // Re-fit when the node count changes substantially (new map, generation).
  const nodeCount = map.nodes.length
  useEffect(() => {
    const t = setTimeout(() => fitView({ duration: 300, padding: 0.2 }), 60)
    return () => clearTimeout(t)
  }, [map.id, fitView])
  useEffect(() => {
    const t = setTimeout(() => fitView({ duration: 300, padding: 0.2 }), 60)
    return () => clearTimeout(t)
  }, [nodeCount, fitView])

  return (
    <div className="app" ref={containerRef}>
      <Toolbar
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenGenerate={() => setGenerateOpen(true)}
        onToggleChat={() => setChatOpen((v) => !v)}
        chatOpen={chatOpen}
        ai={ai}
      />
      <div className="canvas-wrap">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onNodeContextMenu={onNodeContextMenu}
          onPaneContextMenu={(e) => {
            e.preventDefault()
            setMenu(null)
          }}
          onPaneClick={() => {
            select(null)
            setMenu(null)
          }}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          elementsSelectable
          deleteKeyCode={null}
          fitView
          minZoom={0.2}
          maxZoom={2}
          defaultEdgeOptions={{ type: 'smoothstep' }}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} size={1} color="#222733" />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            bgColor="#161a22"
            nodeColor="#2a3550"
            nodeStrokeColor="#3a4456"
            maskColor="rgba(10,12,16,0.6)"
            style={{ backgroundColor: '#161a22' }}
          />
        </ReactFlow>
        {ai.busy && (
          <div className="ai-banner">
            {ai.statusText}
            <button onClick={ai.cancel}>Cancelar</button>
          </div>
        )}
        {menu && (
          <ContextMenu
            menu={menu}
            ai={ai}
            onAskAI={(id) => setAskAiNode(id)}
            onClose={() => setMenu(null)}
          />
        )}
        {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} />}
      </div>
      {askAiNode && (
        <AskAiModal nodeId={askAiNode} ai={ai} onClose={() => setAskAiNode(null)} />
      )}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {generateOpen && (
        <GeneratePanel
          ai={ai}
          onClose={() => setGenerateOpen(false)}
        />
      )}
    </div>
  )
}

export default function App(): JSX.Element {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  )
}
