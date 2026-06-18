import type { ChatMessage, MindMap, MindNode } from '@shared/types'

const SYSTEM = `Você é um assistente de brainstorming que estrutura ideias em mapas mentais.
Responda SEMPRE e SOMENTE com JSON válido, sem markdown, sem comentários, sem texto fora do JSON.
Use português do Brasil. Mantenha cada item curto (1 a 5 palavras quando possível).`

/**
 * Find the first balanced {...} or [...] block starting at `from`, correctly
 * skipping braces that appear inside string literals.
 */
function balancedSlice(s: string, from: number): string | null {
  const open = s[from]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inStr = false
  let escaped = false
  for (let i = from; i < s.length; i++) {
    const ch = s[i]
    if (inStr) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return s.slice(from, i + 1)
    }
  }
  return null
}

/**
 * Best-effort extraction of a JSON object/array from a model response. Handles
 * reasoning models that wrap output in <think> blocks, markdown code fences,
 * leading/trailing prose, and stray trailing commas.
 */
export function extractJson<T>(text: string): T {
  let body = text
    // Strip reasoning / thinking blocks.
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    // Strip harmony/channel style control tokens.
    .replace(/<\|[^|]*\|>/g, '')
    .trim()

  // Prefer the content of a ```json fence when present.
  const fenced = body.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) body = fenced[1].trim()

  // Scan for the first brace/bracket that yields a balanced block.
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '{' || body[i] === '[') {
      const slice = balancedSlice(body, i)
      if (slice) {
        const cleaned = slice.replace(/,(\s*[}\]])/g, '$1') // drop trailing commas
        try {
          return JSON.parse(cleaned) as T
        } catch {
          // keep scanning for a later valid block
        }
      }
    }
  }
  throw new Error(
    'O modelo não retornou JSON válido. Resposta: ' + text.slice(0, 160).replace(/\s+/g, ' ')
  )
}

interface TreeNodeJson {
  text: string
  children?: TreeNodeJson[]
}

/** Build a prompt that asks for a whole mind map tree from a topic or full text. */
export function buildGenerateMapMessages(topic: string, depth = 2, breadth = 4): ChatMessage[] {
  const isLongText = topic.length > 200
  const task = isLongText
    ? `Organize o CONTEÚDO a seguir em um mapa mental, extraindo os temas e subtemas principais:\n\n"""${topic}"""`
    : `Crie um mapa mental sobre o tema: "${topic}".`
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `${task}

Regras:
- O nó central ("text" da raiz) deve ser o assunto principal, curto e específico (NÃO use "Mapa mental" nem "Tema").
- Gere cerca de ${breadth} ramos no primeiro nível, cada um com um rótulo significativo (evite genéricos como "Definição", "Importância" salvo se fizer sentido).
- Profundidade de até ${depth} níveis. Cada item curto (1 a 5 palavras).
Formato EXATO:
{"text":"<tema central>","children":[{"text":"<ramo>","children":[{"text":"<subitem>"}]}]}
Retorne apenas esse JSON.`
    }
  ]
}

/** Ask for N short subtopics for an existing node, with surrounding context. */
export function buildExpandMessages(
  node: MindNode,
  path: string[],
  existing: string[] = [],
  count = 5
): ChatMessage[] {
  const context = path.length > 1 ? `Caminho até este nó: ${path.join(' › ')}.` : ''
  const avoid =
    existing.length > 0
      ? `\nNÃO repita nem crie sinônimos destes itens que JÁ EXISTEM no mapa: ${existing
          .map((e) => `"${e}"`)
          .join(', ')}.`
      : ''
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `${context}
Liste ${count} subtópicos relevantes e distintos especificamente para "${node.text}" (e que façam sentido dentro do caminho acima).${avoid}
Formato EXATO: {"items":["...","...","..."]}
Retorne apenas esse JSON.`
    }
  ]
}

export function buildRephraseMessages(node: MindNode, instruction: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `Reescreva o texto do nó a seguir conforme a instrução.
Texto: "${node.text}"
Instrução: ${instruction}
Formato EXATO: {"text":"<novo texto>"}
Retorne apenas esse JSON.`
    }
  ]
}

// ---- JSON schemas (GBNF-compatible) to constrain local generation ----

type JsonSchema = Record<string, unknown>

/** Depth-bounded tree schema: {text, children:[{text, children:[...]}]}. */
export function mapSchema(depth: number): JsonSchema {
  const node = (level: number): JsonSchema => {
    const props: JsonSchema = { text: { type: 'string' } }
    if (level < depth) {
      props.children = { type: 'array', items: node(level + 1) }
    }
    return { type: 'object', properties: props }
  }
  return node(1)
}

export const expandSchema: JsonSchema = {
  type: 'object',
  properties: {
    items: { type: 'array', items: { type: 'string' } }
  }
}

export const rephraseSchema: JsonSchema = {
  type: 'object',
  properties: { text: { type: 'string' } }
}

export const explainSchema = rephraseSchema

/** Two-level subtree under a node. */
export const deepExpandSchema: JsonSchema = {
  type: 'object',
  properties: {
    children: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          children: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' } } } }
        }
      }
    }
  }
}

export function buildExplainMessages(node: MindNode, path: string[]): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `Caminho: ${path.join(' › ')}.
Escreva UMA explicação curta (máx. 1 frase, ~12 palavras) para "${node.text}".
Formato EXATO: {"text":"<explicação>"}
Retorne apenas esse JSON.`
    }
  ]
}

export function buildDeepExpandMessages(
  node: MindNode,
  path: string[],
  existing: string[] = [],
  breadth = 4,
  sub = 3
): ChatMessage[] {
  const avoid =
    existing.length > 0
      ? `\nNÃO repita estes itens que já existem no mapa: ${existing.map((e) => `"${e}"`).join(', ')}.`
      : ''
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `Caminho até este nó: ${path.join(' › ')}.
Expanda "${node.text}" em uma sub-árvore de 2 níveis: ~${breadth} subtópicos, cada um com ~${sub} itens.${avoid}
Itens curtos (1 a 5 palavras), específicos e distintos.
Formato EXATO: {"children":[{"text":"<sub>","children":[{"text":"<item>"}]}]}
Retorne apenas esse JSON.`
    }
  ]
}

/** Compact list of every node's text, for global de-duplication context. */
export function allTexts(map: MindMap, exclude: Set<string> = new Set()): string[] {
  return map.nodes.filter((n) => !exclude.has(n.id)).map((n) => n.text)
}

interface DeepJson {
  children?: { text: string; children?: { text: string }[] }[]
}

/** Build MindNode[] for a deep-expand result under a parent. */
export function deepToNodes(
  data: DeepJson,
  parentId: string,
  genId: () => string
): MindNode[] {
  const out: MindNode[] = []
  for (const c of data.children ?? []) {
    const cid = genId()
    out.push({ id: cid, text: c.text || '...', parentId })
    for (const g of c.children ?? []) {
      out.push({ id: genId(), text: g.text || '...', parentId: cid })
    }
  }
  return out
}

/**
 * Parse a markdown-ish outline (bullets / headings / indentation) into MindNode[]
 * under `rootParentId`. Used to insert a chat answer as a subtree.
 */
export function parseOutlineToNodes(
  text: string,
  rootParentId: string,
  genId: () => string
): MindNode[] {
  const out: MindNode[] = []
  // stack of { id, depth }
  const stack: { id: string; depth: number }[] = []
  const lines = text.split('\n')
  for (const raw of lines) {
    if (!raw.trim()) continue
    const indentMatch = raw.match(/^(\s*)/)
    const leading = indentMatch ? indentMatch[1].replace(/\t/g, '  ').length : 0
    let content = raw.trim()
    let headingDepth = -1
    const h = content.match(/^(#{1,6})\s+/)
    if (h) {
      headingDepth = h[1].length - 1
      content = content.slice(h[0].length)
    }
    // strip bullet / numbering markers
    content = content.replace(/^([-*•+]|\d+[.)])\s+/, '').trim()
    content = content.replace(/\*\*/g, '').replace(/`/g, '')
    if (!content) continue
    const depth = headingDepth >= 0 ? headingDepth : Math.floor(leading / 2) + 1
    // find parent: nearest item with smaller depth
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop()
    const parentId = stack.length ? stack[stack.length - 1].id : rootParentId
    const id = genId()
    out.push({ id, text: content.slice(0, 120), parentId })
    stack.push({ id, depth })
  }
  return out
}

export type { TreeNodeJson }

/** Flatten a TreeNodeJson into MindNode[] under an optional parent. */
export function treeToNodes(
  tree: TreeNodeJson,
  parentId: string | null,
  genId: () => string
): MindNode[] {
  const out: MindNode[] = []
  const walk = (t: TreeNodeJson, pid: string | null): void => {
    const id = genId()
    out.push({ id, text: t.text || '...', parentId: pid })
    for (const c of t.children ?? []) walk(c, id)
  }
  walk(tree, parentId)
  return out
}

/** The path of texts from root down to a node, for prompt context. */
export function nodePath(map: MindMap, id: string): string[] {
  const byId = new Map(map.nodes.map((n) => [n.id, n]))
  const path: string[] = []
  let cur = byId.get(id)
  while (cur) {
    path.unshift(cur.text)
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return path
}
