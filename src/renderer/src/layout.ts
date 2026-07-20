import type { MindNode } from '@shared/types'

export const NODE_W = 220
export const NODE_H = 52
const H_GAP = 80 // depth gap for horizontal directions
const V_DEPTH_GAP = 64 // depth gap for vertical directions
const V_GAP = 22 // sibling gap on the vertical (cross) axis for horizontal layouts
const H_CROSS_GAP = 34 // sibling gap on the horizontal (cross) axis for vertical layouts

export type Side = 'left' | 'right' | 'up' | 'down' | 'root'

export interface Positioned {
  id: string
  x: number
  y: number
}

export interface LayoutResult {
  positions: Map<string, Positioned>
  sides: Map<string, Side>
}

function widthOf(n: MindNode): number {
  return n.width && n.width > 0 ? n.width : NODE_W
}

const NODE_PAD_X = 30 // horizontal padding (bar + paddings) inside a card
const NODE_PAD_Y = 22 // vertical padding inside a card

/**
 * Estimate a node's rendered height from its text, width and font size, so the
 * vertical layout reserves enough room and tall blocks don't overlap siblings.
 * Intentionally a little generous.
 */
function heightOf(n: MindNode): number {
  const w = widthOf(n)
  const fs = n.fontSize && n.fontSize > 0 ? n.fontSize : 13.5
  const charsPerLine = Math.max(6, Math.floor((w - NODE_PAD_X) / (fs * 0.56)))
  // Count explicit line breaks plus wrapped lines.
  const paragraphs = (n.text || ' ').split('\n')
  let lines = 0
  for (const p of paragraphs) lines += Math.max(1, Math.ceil(p.length / charsPerLine))
  const textH = lines * (fs * 1.35)
  return Math.max(NODE_H, Math.round(textH + NODE_PAD_Y))
}

interface Indexed {
  byId: Map<string, MindNode>
  children: Map<string, string[]>
  rootId: string | null
}

/**
 * A raiz do mapa: o PRIMEIRO nó sem pai.
 *
 * Existe pra ser a única resposta pra essa pergunta. Antes o layout pegava a
 * ÚLTIMA raiz (o laço do `index` sobrescrevia `rootId` sem parar) e o export
 * pegava a PRIMEIRA (`.find`) — com dois nós de `parentId: null`, que uma
 * importação ruim ou um merge de mapas produz, a tela desenhava uma árvore e o
 * arquivo exportado gravava outra, sem aviso nenhum.
 *
 * "Primeiro" e não "último" porque é o que a ordem do arquivo já sugere e o
 * que o export sempre fez — mudar o layout é a metade que ninguém percebe.
 */
export function findRoot(nodes: MindNode[]): MindNode | null {
  return nodes.find((n) => n.parentId === null) ?? null
}

function index(nodes: MindNode[]): Indexed {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const children = new Map<string, string[]>()
  const rootId: string | null = findRoot(nodes)?.id ?? null
  for (const n of nodes) {
    if (n.parentId !== null) {
      const arr = children.get(n.parentId) ?? []
      arr.push(n.id)
      children.set(n.parentId, arr)
    }
  }
  return { byId, children, rootId }
}

const isVertical = (d: Side): boolean => d === 'up' || d === 'down'

/** Resolve the direction of every node (same logic the layout uses). */
export function resolveSides(nodes: MindNode[]): Map<string, Side> {
  return computeSides(index(nodes))
}

/** Rendered size estimate for a node (used by export). */
export function nodeSize(n: MindNode): { w: number; h: number } {
  return { w: widthOf(n), h: heightOf(n) }
}

/** Resolve which direction each node sits in (root children explicit or auto-balanced L/R). */
function computeSides(idx: Indexed): Map<string, Side> {
  const sides = new Map<string, Side>()
  if (!idx.rootId) return sides
  sides.set(idx.rootId, 'root')

  const propagate = (id: string, side: Side): void => {
    for (const c of idx.children.get(id) ?? []) {
      sides.set(c, side)
      propagate(c, side)
    }
  }

  let leftLoad = 0
  let rightLoad = 0
  for (const kid of idx.children.get(idx.rootId) ?? []) {
    const explicit = idx.byId.get(kid)?.side
    let side: Side
    if (explicit) {
      side = explicit
    } else {
      side = rightLoad <= leftLoad ? 'right' : 'left'
    }
    // Lado EXPLÍCITO também conta. Decidido em 2026-07-20: o comentário antigo
    // dizia o contrário do que o código faz ("only auto L/R contribute"), e
    // quem está certo é o código — um filho marcado à mão ocupa espaço real
    // naquele lado, então os automáticos seguintes têm que se equilibrar
    // contra ele. Ignorá-lo empilharia os automáticos em cima do explícito.
    if (side === 'left') leftLoad += 1
    else if (side === 'right') rightLoad += 1
    sides.set(kid, side)
    propagate(kid, side)
  }
  return sides
}

/**
 * Balanced, multi-directional mind-map layout. Root sits at the origin; each of
 * its children's subtrees fans out left / right / up / down. Variable node
 * widths are respected. Descendants of collapsed nodes are omitted.
 */
export function layoutTree(nodes: MindNode[]): LayoutResult {
  const idx = index(nodes)
  const positions = new Map<string, Positioned>()
  const sides = computeSides(idx)
  if (!idx.rootId) return { positions, sides }

  const root = idx.byId.get(idx.rootId)!
  const rootW = widthOf(root)
  const rootH = heightOf(root)
  positions.set(idx.rootId, { id: idx.rootId, x: -rootW / 2, y: -rootH / 2 })

  // Cross-axis extent of a subtree, given the direction's orientation.
  const extentCache = new Map<string, number>()
  const extent = (id: string, vert: boolean): number => {
    const key = `${id}:${vert}`
    const cached = extentCache.get(key)
    if (cached != null) return cached
    const node = idx.byId.get(id)!
    const crossSize = vert ? widthOf(node) : heightOf(node)
    const crossGap = vert ? H_CROSS_GAP : V_GAP
    const kids = node.collapsed ? [] : idx.children.get(id) ?? []
    let value = crossSize
    if (kids.length > 0) {
      let sum = 0
      for (const k of kids) sum += extent(k, vert) + crossGap
      sum -= crossGap
      value = Math.max(crossSize, sum)
    }
    extentCache.set(key, value)
    return value
  }

  // Place a subtree. `dir` is one of the four directions. parentCenterDepth /
  // parentDepthSize describe the parent along the depth axis. crossTop is the
  // top edge of this subtree's band on the cross axis.
  const place = (
    id: string,
    dir: Side,
    parentCenterDepth: number,
    parentDepthSize: number,
    crossTop: number
  ): void => {
    const vert = isVertical(dir)
    const depthSign = dir === 'right' || dir === 'down' ? 1 : -1
    const depthGap = vert ? V_DEPTH_GAP : H_GAP
    const crossGap = vert ? H_CROSS_GAP : V_GAP
    const node = idx.byId.get(id)!
    const myDepthSize = vert ? heightOf(node) : widthOf(node)
    const e = extent(id, vert)
    const crossCenter = crossTop + e / 2
    const myCenterDepth =
      parentCenterDepth + depthSign * ((parentDepthSize + myDepthSize) / 2 + depthGap)

    const centerX = vert ? crossCenter : myCenterDepth
    const centerY = vert ? myCenterDepth : crossCenter
    positions.set(id, { id, x: centerX - widthOf(node) / 2, y: centerY - heightOf(node) / 2 })

    const kids = node.collapsed ? [] : idx.children.get(id) ?? []
    let childTop = crossTop
    for (const k of kids) {
      const ke = extent(k, vert)
      place(k, dir, myCenterDepth, myDepthSize, childTop)
      childTop += ke + crossGap
    }
  }

  const rootKids = root.collapsed ? [] : idx.children.get(idx.rootId) ?? []
  const groups: Record<'left' | 'right' | 'up' | 'down', string[]> = {
    left: [],
    right: [],
    up: [],
    down: []
  }
  for (const k of rootKids) {
    const s = sides.get(k)
    if (s === 'left' || s === 'right' || s === 'up' || s === 'down') groups[s].push(k)
  }

  const blockExtent = (ids: string[], vert: boolean): number => {
    if (ids.length === 0) return 0
    const crossGap = vert ? H_CROSS_GAP : V_GAP
    let total = 0
    for (const k of ids) total += extent(k, vert) + crossGap
    return total - crossGap
  }

  for (const dir of ['right', 'left', 'down', 'up'] as const) {
    const kids = groups[dir]
    if (kids.length === 0) continue
    const vert = isVertical(dir)
    // Parent (root) depth size depends on orientation.
    const parentDepthSize = vert ? rootH : rootW
    let top = -blockExtent(kids, vert) / 2
    for (const k of kids) {
      place(k, dir, 0, parentDepthSize, top)
      top += extent(k, vert) + (vert ? H_CROSS_GAP : V_GAP)
    }
  }

  return { positions, sides }
}

/** Ids of all descendants of `id` (regardless of collapse state). */
export function descendantIds(nodes: MindNode[], id: string): Set<string> {
  const { children } = index(nodes)
  const out = new Set<string>()
  const stack = [...(children.get(id) ?? [])]
  while (stack.length) {
    const cur = stack.pop()!
    out.add(cur)
    for (const c of children.get(cur) ?? []) stack.push(c)
  }
  return out
}

/** Ids of nodes hidden because an ancestor is collapsed. */
export function hiddenIds(nodes: MindNode[]): Set<string> {
  const hidden = new Set<string>()
  for (const n of nodes) {
    if (n.collapsed) {
      for (const d of descendantIds(nodes, n.id)) hidden.add(d)
    }
  }
  return hidden
}
