import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { MindMap, MindNode } from '@shared/types'
import { resolveSides } from './layout'
import { t } from './lib/i18n'

function now(): number {
  return Date.now()
}

export function createEmptyMap(): MindMap {
  const rootId = nanoid(8)
  return {
    id: nanoid(8),
    title: t('map.new'),
    createdAt: now(),
    updatedAt: now(),
    nodes: [{ id: rootId, text: t('node.central'), parentId: null }]
  }
}

const MAX_HISTORY = 100

interface MapState {
  map: MindMap
  filePath: string | null
  selectedId: string | null
  /** Node currently in inline-edit mode (drives auto-edit on create). */
  editingId: string | null
  dirty: boolean
  past: MindMap[]
  future: MindMap[]

  setMap: (map: MindMap, filePath?: string | null) => void
  newMap: () => void
  select: (id: string | null) => void
  setEditing: (id: string | null) => void

  rootId: () => string
  getNode: (id: string) => MindNode | undefined
  childrenOf: (id: string | null) => MindNode[]

  addChild: (
    parentId: string,
    text?: string,
    edit?: boolean,
    side?: MindNode['side']
  ) => string
  addSibling: (siblingId: string, text?: string, edit?: boolean) => string | null
  updateText: (id: string, text: string) => void
  setColor: (id: string, color?: string) => void
  setNote: (id: string, note: string) => void
  setWidth: (id: string, width?: number) => void
  setFontSize: (id: string, fontSize?: number) => void
  setSide: (id: string, side: MindNode['side']) => void
  toggleCollapse: (id: string) => void
  deleteNode: (id: string) => void
  addChildren: (parentId: string, texts: string[]) => string[]
  /** Append an already-built subtree (nodes with parentIds set). Uncollapses the target parent. */
  addNodes: (newNodes: MindNode[], uncollapseParentId?: string) => void

  // Structural editing
  moveUp: (id: string) => void
  moveDown: (id: string) => void
  indent: (id: string) => void
  outdent: (id: string) => void

  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  markSaved: (filePath?: string | null) => void
}

export const useMap = create<MapState>((set, get) => {
  /** Apply a transform to the node list, recording history. */
  const commit = (
    producer: (nodes: MindNode[]) => MindNode[],
    extra?: Partial<Pick<MapState, 'selectedId' | 'editingId'>>
  ): void => {
    set((s) => ({
      past: [...s.past, s.map].slice(-MAX_HISTORY),
      future: [],
      map: { ...s.map, nodes: producer(s.map.nodes), updatedAt: now() },
      dirty: true,
      ...extra
    }))
  }

  const siblingsArr = (nodes: MindNode[], parentId: string | null): MindNode[] =>
    nodes.filter((n) => n.parentId === parentId)

  return {
    map: createEmptyMap(),
    filePath: null,
    selectedId: null,
    editingId: null,
    dirty: false,
    past: [],
    future: [],

    setMap: (map, filePath) =>
      set({
        map,
        filePath: filePath ?? null,
        selectedId: map.nodes[0]?.id ?? null,
        editingId: null,
        dirty: false,
        past: [],
        future: []
      }),

    newMap: () => {
      const map = createEmptyMap()
      set({
        map,
        filePath: null,
        selectedId: map.nodes[0].id,
        editingId: null,
        dirty: false,
        past: [],
        future: []
      })
    },

    select: (id) => set({ selectedId: id }),
    setEditing: (id) => set({ editingId: id }),

    rootId: () => get().map.nodes.find((n) => n.parentId === null)?.id ?? get().map.nodes[0]?.id,
    getNode: (id) => get().map.nodes.find((n) => n.id === id),
    childrenOf: (id) => get().map.nodes.filter((n) => n.parentId === id),

    addChild: (parentId, text = t('node.new'), edit = true, side) => {
      const id = nanoid(8)
      commit(
        (nodes) =>
          [
            ...nodes.map((n) => (n.id === parentId && n.collapsed ? { ...n, collapsed: false } : n)),
            { id, text, parentId, ...(side ? { side } : {}) }
          ],
        { selectedId: id, editingId: edit ? id : null }
      )
      return id
    },

    addSibling: (siblingId, text = t('node.new'), edit = true) => {
      const sib = get().getNode(siblingId)
      if (!sib || sib.parentId === null) return null
      const id = nanoid(8)
      // If the sibling is a root child, the new node must stay on the same side.
      // Auto-balancing is unstable when children are added, so we freeze both.
      const isRootChild = sib.parentId === get().rootId()
      let frozen: MindNode['side']
      if (isRootChild) {
        const resolved = resolveSides(get().map.nodes).get(siblingId)
        if (resolved && resolved !== 'root') frozen = resolved
      }
      // Insert right after the sibling so visual order is natural.
      commit(
        (nodes) => {
          const idx = nodes.findIndex((n) => n.id === siblingId)
          const next = [...nodes]
          if (frozen) next[idx] = { ...next[idx], side: frozen }
          next.splice(idx + 1, 0, {
            id,
            text,
            parentId: sib.parentId,
            ...(frozen ? { side: frozen } : {})
          })
          return next
        },
        { selectedId: id, editingId: edit ? id : null }
      )
      return id
    },

    addChildren: (parentId, texts) => {
      const ids = texts.map(() => nanoid(8))
      commit((nodes) => [
        ...nodes.map((n) => (n.id === parentId && n.collapsed ? { ...n, collapsed: false } : n)),
        ...texts.map((text, i) => ({ id: ids[i], text, parentId }))
      ])
      return ids
    },

    addNodes: (newNodes, uncollapseParentId) => {
      if (newNodes.length === 0) return
      commit((nodes) => [
        ...nodes.map((n) =>
          n.id === uncollapseParentId && n.collapsed ? { ...n, collapsed: false } : n
        ),
        ...newNodes
      ])
    },

    updateText: (id, text) =>
      commit((nodes) => nodes.map((n) => (n.id === id ? { ...n, text } : n))),

    setColor: (id, color) =>
      commit((nodes) => nodes.map((n) => (n.id === id ? { ...n, color } : n))),

    setNote: (id, note) => commit((nodes) => nodes.map((n) => (n.id === id ? { ...n, note } : n))),

    setWidth: (id, width) =>
      commit((nodes) => nodes.map((n) => (n.id === id ? { ...n, width } : n))),

    setFontSize: (id, fontSize) =>
      commit((nodes) => nodes.map((n) => (n.id === id ? { ...n, fontSize } : n))),

    setSide: (id, side) =>
      commit((nodes) => nodes.map((n) => (n.id === id ? { ...n, side } : n))),

    toggleCollapse: (id) =>
      commit((nodes) => nodes.map((n) => (n.id === id ? { ...n, collapsed: !n.collapsed } : n))),

    deleteNode: (id) => {
      const { map } = get()
      const root = map.nodes.find((n) => n.parentId === null)
      if (root && root.id === id) return
      const toRemove = new Set<string>([id])
      let grew = true
      while (grew) {
        grew = false
        for (const n of map.nodes) {
          if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
            toRemove.add(n.id)
            grew = true
          }
        }
      }
      const parentId = get().getNode(id)?.parentId ?? null
      commit((nodes) => nodes.filter((n) => !toRemove.has(n.id)), { selectedId: parentId })
    },

    moveUp: (id) => {
      const node = get().getNode(id)
      if (!node) return
      commit((nodes) => {
        const sibs = siblingsArr(nodes, node.parentId)
        const pos = sibs.findIndex((n) => n.id === id)
        if (pos <= 0) return nodes
        return swapInArray(nodes, sibs[pos].id, sibs[pos - 1].id)
      })
    },

    moveDown: (id) => {
      const node = get().getNode(id)
      if (!node) return
      commit((nodes) => {
        const sibs = siblingsArr(nodes, node.parentId)
        const pos = sibs.findIndex((n) => n.id === id)
        if (pos < 0 || pos >= sibs.length - 1) return nodes
        return swapInArray(nodes, sibs[pos].id, sibs[pos + 1].id)
      })
    },

    // Indent: become a child of the previous sibling.
    indent: (id) => {
      const node = get().getNode(id)
      if (!node) return
      commit((nodes) => {
        const sibs = siblingsArr(nodes, node.parentId)
        const pos = sibs.findIndex((n) => n.id === id)
        if (pos <= 0) return nodes
        const newParentId = sibs[pos - 1].id
        return nodes.map((n) =>
          n.id === id ? { ...n, parentId: newParentId } : n.id === newParentId ? { ...n, collapsed: false } : n
        )
      })
    },

    // Outdent: become a sibling of the current parent.
    outdent: (id) => {
      const node = get().getNode(id)
      if (!node || node.parentId === null) return
      const parent = get().getNode(node.parentId)
      if (!parent || parent.parentId === null) return // can't outdent to root level
      const grandparentId = parent.parentId
      commit((nodes) => nodes.map((n) => (n.id === id ? { ...n, parentId: grandparentId } : n)))
    },

    undo: () =>
      set((s) => {
        if (!s.past.length) return s
        const prev = s.past[s.past.length - 1]
        return {
          map: prev,
          past: s.past.slice(0, -1),
          future: [s.map, ...s.future].slice(0, MAX_HISTORY),
          dirty: true,
          editingId: null
        }
      }),

    redo: () =>
      set((s) => {
        if (!s.future.length) return s
        const next = s.future[0]
        return {
          map: next,
          past: [...s.past, s.map].slice(-MAX_HISTORY),
          future: s.future.slice(1),
          dirty: true,
          editingId: null
        }
      }),

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    markSaved: (filePath) => set((s) => ({ filePath: filePath ?? s.filePath, dirty: false }))
  }
})

/** Swap the array positions of two node objects (keeps sibling visual order). */
function swapInArray(nodes: MindNode[], aId: string, bId: string): MindNode[] {
  const ai = nodes.findIndex((n) => n.id === aId)
  const bi = nodes.findIndex((n) => n.id === bId)
  if (ai < 0 || bi < 0) return nodes
  const next = [...nodes]
  ;[next[ai], next[bi]] = [next[bi], next[ai]]
  return next
}
