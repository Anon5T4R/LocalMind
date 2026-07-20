import type { MindMap, MindNode } from '@shared/types'
import { findRoot, layoutTree, nodeSize } from './layout'
import { localeTag, t } from './lib/i18n'

interface Tree {
  node: MindNode
  children: Tree[]
}

function buildTree(map: MindMap): Tree | null {
  const byParent = new Map<string | null, MindNode[]>()
  for (const n of map.nodes) {
    const arr = byParent.get(n.parentId) ?? []
    arr.push(n)
    byParent.set(n.parentId, arr)
  }
  // Mesma raiz que o layout usa — ver `findRoot`. Duas respostas diferentes pra
  // "qual é a raiz" faziam a tela e o arquivo exportado discordarem.
  const root = findRoot(map.nodes)
  if (!root) return null
  const make = (n: MindNode): Tree => ({
    node: n,
    children: (byParent.get(n.id) ?? []).map(make)
  })
  return make(root)
}

/** Markdown nested-bullet outline (also a decent format to re-import mentally). */
export function mapToMarkdown(map: MindMap): string {
  const tree = buildTree(map)
  if (!tree) return ''
  // A nota da RAIZ tem que sair aqui: o `walk` abaixo só visita os filhos,
  // então a nota do nó central se perdia no export — calada.
  const lines: string[] = [`# ${tree.node.text}`, '']
  if (tree.node.note) lines.push(`_${tree.node.note}_`, '')
  const walk = (t: Tree, depth: number): void => {
    for (const c of t.children) {
      lines.push(`${'  '.repeat(depth)}- ${c.node.text}${c.node.note ? ` — _${c.node.note}_` : ''}`)
      walk(c, depth + 1)
    }
  }
  walk(tree, 0)
  return lines.join('\n') + '\n'
}

/** Self-contained HTML page with a nested list. */
export function mapToHtml(map: MindMap): string {
  const tree = buildTree(map)
  if (!tree) return `<!doctype html><title>${t('export.empty')}</title>`
  const esc = (s: string): string =>
    s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
  const render = (t: Tree): string => {
    const note = t.node.note ? `<span class="note">${esc(t.node.note)}</span>` : ''
    const kids = t.children.length
      ? `<ul>${t.children.map(render).join('')}</ul>`
      : ''
    const color = t.node.color ? ` style="border-color:${esc(t.node.color)}"` : ''
    return `<li><span class="t"${color}>${esc(t.node.text)}</span>${note}${kids}</li>`
  }
  return `<!doctype html>
<html lang="${localeTag()}"><head><meta charset="utf-8">
<title>${esc(tree.node.text)}</title>
<style>
  body{background:#0f1115;color:#e6e9ef;font-family:Segoe UI,system-ui,sans-serif;padding:32px;line-height:1.5}
  h1{color:#a692ff}
  ul{list-style:none;border-left:1px solid #2a3140;margin-left:10px;padding-left:18px}
  li{margin:6px 0}
  .t{display:inline-block;background:#1b2029;border:1px solid #2a3140;border-left:4px solid #3a8dde;border-radius:8px;padding:4px 10px}
  .note{color:#8a93a6;font-size:.85em;margin-left:8px}
</style></head>
<body><h1>${esc(tree.node.text)}</h1>${
    tree.node.note ? `<p class="note">${esc(tree.node.note)}</p>` : ''
  }<ul>${tree.children.map(render).join('')}</ul></body></html>`
}

/** Render the map to a PNG data URL by drawing the layout onto a canvas. */
export function mapToPngDataUrl(map: MindMap): string {
  const { positions } = layoutTree(map.nodes)
  const byId = new Map(map.nodes.map((n) => [n.id, n]))

  // Compute bounds.
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of map.nodes) {
    const p = positions.get(n.id)
    if (!p) continue
    const { w, h } = nodeSize(n)
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x + w)
    maxY = Math.max(maxY, p.y + h)
  }
  if (!isFinite(minX)) return ''

  const pad = 60
  const scale = 2 // retina
  const W = maxX - minX + pad * 2
  const H = maxY - minY + pad * 2
  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  const ox = -minX + pad
  const oy = -minY + pad

  ctx.fillStyle = '#0f1115'
  ctx.fillRect(0, 0, W, H)

  const roundRect = (x: number, y: number, w: number, h: number, r: number): void => {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  // Edges first.
  ctx.strokeStyle = '#3a4456'
  ctx.lineWidth = 1.5
  for (const n of map.nodes) {
    if (!n.parentId) continue
    const p = positions.get(n.id)
    const pp = positions.get(n.parentId)
    if (!p || !pp) continue
    const parent = byId.get(n.parentId)!
    const ps = nodeSize(parent)
    const cs = nodeSize(n)
    const x1 = pp.x + ps.w / 2 + ox
    const y1 = pp.y + ps.h / 2 + oy
    const x2 = p.x + cs.w / 2 + ox
    const y2 = p.y + cs.h / 2 + oy
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.bezierCurveTo((x1 + x2) / 2, y1, (x1 + x2) / 2, y2, x2, y2)
    ctx.stroke()
  }

  // Nodes.
  for (const n of map.nodes) {
    const p = positions.get(n.id)
    if (!p) continue
    const { w, h } = nodeSize(n)
    const x = p.x + ox
    const y = p.y + oy
    const isRoot = n.parentId === null
    const accent = n.color || (isRoot ? '#7c5cff' : '#3a8dde')
    ctx.fillStyle = isRoot ? '#232038' : '#1b2029'
    roundRect(x, y, w, h, 10)
    ctx.fill()
    // accent bar
    ctx.fillStyle = accent
    roundRect(x, y, 5, h, 3)
    ctx.fill()
    // text (wrapped)
    const fs = n.fontSize && n.fontSize > 0 ? n.fontSize : 13.5
    ctx.fillStyle = '#e6e9ef'
    ctx.font = `${isRoot ? '600 ' : ''}${fs}px Segoe UI, system-ui, sans-serif`
    ctx.textBaseline = 'top'
    const maxW = w - 24
    const words = n.text.split(/\s+/)
    const lines: string[] = []
    let cur = ''
    for (const word of words) {
      const test = cur ? cur + ' ' + word : word
      if (ctx.measureText(test).width > maxW && cur) {
        lines.push(cur)
        cur = word
      } else cur = test
    }
    if (cur) lines.push(cur)
    const lineH = fs * 1.35
    let ty = y + (h - lines.length * lineH) / 2
    for (const ln of lines) {
      ctx.fillText(ln, x + 14, ty)
      ty += lineH
    }
  }

  return canvas.toDataURL('image/png')
}
