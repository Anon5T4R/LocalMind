import type { ChatMessage, MindMap, MindNode } from '@shared/types'
import { getLocale, t, type Locale } from '../lib/i18n'

/**
 * Natural-language prompt fragments per locale, so the MODEL answers in the UI
 * language. IMPORTANT: the JSON contract tokens/keys ("text", "children",
 * "items") and the exact-format examples are NOT translated — only the human
 * text around them changes. Localized at call time via getLocale().
 */
interface PromptStrings {
  system: string
  genTaskLong: (topic: string) => string
  genTaskShort: (topic: string) => string
  genRules: (breadth: number, depth: number) => string
  expandCtx: (path: string) => string
  expandAvoid: (list: string) => string
  expandBody: (ctx: string, count: number, text: string, avoid: string) => string
  rephrase: (text: string, instruction: string) => string
  explain: (path: string, text: string) => string
  deepAvoid: (list: string) => string
  deepBody: (path: string, text: string, breadth: number, sub: number, avoid: string) => string
}

const PROMPTS: Record<Locale, PromptStrings> = {
  pt: {
    system: `Você é um assistente de brainstorming que estrutura ideias em mapas mentais.
Responda SEMPRE e SOMENTE com JSON válido, sem markdown, sem comentários, sem texto fora do JSON.
Use português do Brasil. Mantenha cada item curto (1 a 5 palavras quando possível).`,
    genTaskLong: (topic) =>
      `Organize o CONTEÚDO a seguir em um mapa mental, extraindo os temas e subtemas principais:\n\n"""${topic}"""`,
    genTaskShort: (topic) => `Crie um mapa mental sobre o tema: "${topic}".`,
    genRules: (breadth, depth) => `Regras:
- O nó central ("text" da raiz) deve ser o assunto principal, curto e específico (NÃO use "Mapa mental" nem "Tema").
- Gere cerca de ${breadth} ramos no primeiro nível, cada um com um rótulo significativo (evite genéricos como "Definição", "Importância" salvo se fizer sentido).
- Profundidade de até ${depth} níveis. Cada item curto (1 a 5 palavras).
Formato EXATO:
{"text":"<tema central>","children":[{"text":"<ramo>","children":[{"text":"<subitem>"}]}]}
Retorne apenas esse JSON.`,
    expandCtx: (path) => `Caminho até este nó: ${path}.`,
    expandAvoid: (list) =>
      `\nNÃO repita nem crie sinônimos destes itens que JÁ EXISTEM no mapa: ${list}.`,
    expandBody: (ctx, count, text, avoid) => `${ctx}
Liste ${count} subtópicos relevantes e distintos especificamente para "${text}" (e que façam sentido dentro do caminho acima).${avoid}
Formato EXATO: {"items":["...","...","..."]}
Retorne apenas esse JSON.`,
    rephrase: (text, instruction) => `Reescreva o texto do nó a seguir conforme a instrução.
Texto: "${text}"
Instrução: ${instruction}
Formato EXATO: {"text":"<novo texto>"}
Retorne apenas esse JSON.`,
    explain: (path, text) => `Caminho: ${path}.
Escreva UMA explicação curta (máx. 1 frase, ~12 palavras) para "${text}".
Formato EXATO: {"text":"<explicação>"}
Retorne apenas esse JSON.`,
    deepAvoid: (list) => `\nNÃO repita estes itens que já existem no mapa: ${list}.`,
    deepBody: (path, text, breadth, sub, avoid) => `Caminho até este nó: ${path}.
Expanda "${text}" em uma sub-árvore de 2 níveis: ~${breadth} subtópicos, cada um com ~${sub} itens.${avoid}
Itens curtos (1 a 5 palavras), específicos e distintos.
Formato EXATO: {"children":[{"text":"<sub>","children":[{"text":"<item>"}]}]}
Retorne apenas esse JSON.`
  },
  en: {
    system: `You are a brainstorming assistant that structures ideas into mind maps.
ALWAYS reply with ONLY valid JSON — no markdown, no comments, no text outside the JSON.
Write in English. Keep each item short (1 to 5 words when possible).`,
    genTaskLong: (topic) =>
      `Organize the CONTENT below into a mind map, extracting the main themes and subthemes:\n\n"""${topic}"""`,
    genTaskShort: (topic) => `Create a mind map about the topic: "${topic}".`,
    genRules: (breadth, depth) => `Rules:
- The central node (the root "text") must be the main subject, short and specific (do NOT use "Mind map" or "Topic").
- Generate about ${breadth} branches at the first level, each with a meaningful label (avoid generic ones like "Definition", "Importance" unless it makes sense).
- Depth of up to ${depth} levels. Each item short (1 to 5 words).
EXACT format:
{"text":"<central topic>","children":[{"text":"<branch>","children":[{"text":"<subitem>"}]}]}
Return only that JSON.`,
    expandCtx: (path) => `Path to this node: ${path}.`,
    expandAvoid: (list) =>
      `\nDo NOT repeat or create synonyms of these items that ALREADY EXIST in the map: ${list}.`,
    expandBody: (ctx, count, text, avoid) => `${ctx}
List ${count} relevant and distinct subtopics specifically for "${text}" (that make sense within the path above).${avoid}
EXACT format: {"items":["...","...","..."]}
Return only that JSON.`,
    rephrase: (text, instruction) => `Rewrite the node's text below according to the instruction.
Text: "${text}"
Instruction: ${instruction}
EXACT format: {"text":"<new text>"}
Return only that JSON.`,
    explain: (path, text) => `Path: ${path}.
Write ONE short explanation (max. 1 sentence, ~12 words) for "${text}".
EXACT format: {"text":"<explanation>"}
Return only that JSON.`,
    deepAvoid: (list) => `\nDo NOT repeat these items that already exist in the map: ${list}.`,
    deepBody: (path, text, breadth, sub, avoid) => `Path to this node: ${path}.
Expand "${text}" into a 2-level subtree: ~${breadth} subtopics, each with ~${sub} items.${avoid}
Short items (1 to 5 words), specific and distinct.
EXACT format: {"children":[{"text":"<sub>","children":[{"text":"<item>"}]}]}
Return only that JSON.`
  },
  es: {
    system: `Eres un asistente de brainstorming que estructura ideas en mapas mentales.
Responde SIEMPRE y SOLO con JSON válido, sin markdown, sin comentarios, sin texto fuera del JSON.
Escribe en español. Mantén cada elemento corto (1 a 5 palabras cuando sea posible).`,
    genTaskLong: (topic) =>
      `Organiza el CONTENIDO siguiente en un mapa mental, extrayendo los temas y subtemas principales:\n\n"""${topic}"""`,
    genTaskShort: (topic) => `Crea un mapa mental sobre el tema: "${topic}".`,
    genRules: (breadth, depth) => `Reglas:
- El nodo central (el "text" de la raíz) debe ser el tema principal, corto y específico (NO uses "Mapa mental" ni "Tema").
- Genera unas ${breadth} ramas en el primer nivel, cada una con una etiqueta significativa (evita genéricas como "Definición", "Importancia" salvo que tenga sentido).
- Profundidad de hasta ${depth} niveles. Cada elemento corto (1 a 5 palabras).
Formato EXACTO:
{"text":"<tema central>","children":[{"text":"<rama>","children":[{"text":"<subelemento>"}]}]}
Devuelve solo ese JSON.`,
    expandCtx: (path) => `Ruta hasta este nodo: ${path}.`,
    expandAvoid: (list) =>
      `\nNO repitas ni crees sinónimos de estos elementos que YA EXISTEN en el mapa: ${list}.`,
    expandBody: (ctx, count, text, avoid) => `${ctx}
Enumera ${count} subtemas relevantes y distintos específicamente para "${text}" (y que tengan sentido dentro de la ruta anterior).${avoid}
Formato EXACTO: {"items":["...","...","..."]}
Devuelve solo ese JSON.`,
    rephrase: (text, instruction) => `Reescribe el texto del nodo siguiente según la instrucción.
Texto: "${text}"
Instrucción: ${instruction}
Formato EXACTO: {"text":"<nuevo texto>"}
Devuelve solo ese JSON.`,
    explain: (path, text) => `Ruta: ${path}.
Escribe UNA explicación corta (máx. 1 frase, ~12 palabras) para "${text}".
Formato EXACTO: {"text":"<explicación>"}
Devuelve solo ese JSON.`,
    deepAvoid: (list) => `\nNO repitas estos elementos que ya existen en el mapa: ${list}.`,
    deepBody: (path, text, breadth, sub, avoid) => `Ruta hasta este nodo: ${path}.
Expande "${text}" en un subárbol de 2 niveles: ~${breadth} subtemas, cada uno con ~${sub} elementos.${avoid}
Elementos cortos (1 a 5 palabras), específicos y distintos.
Formato EXACTO: {"children":[{"text":"<sub>","children":[{"text":"<item>"}]}]}
Devuelve solo ese JSON.`
  }
}

/** Prompt fragments for the current UI locale. */
function P(): PromptStrings {
  return PROMPTS[getLocale()]
}

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
  throw new Error(t('ai.err.noJson', { resp: text.slice(0, 160).replace(/\s+/g, ' ') }))
}

interface TreeNodeJson {
  text: string
  children?: TreeNodeJson[]
}

/** Build a prompt that asks for a whole mind map tree from a topic or full text. */
export function buildGenerateMapMessages(topic: string, depth = 2, breadth = 4): ChatMessage[] {
  const p = P()
  const isLongText = topic.length > 200
  const task = isLongText ? p.genTaskLong(topic) : p.genTaskShort(topic)
  return [
    { role: 'system', content: p.system },
    {
      role: 'user',
      content: `${task}\n\n${p.genRules(breadth, depth)}`
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
  const p = P()
  const context = path.length > 1 ? p.expandCtx(path.join(' › ')) : ''
  const avoid =
    existing.length > 0 ? p.expandAvoid(existing.map((e) => `"${e}"`).join(', ')) : ''
  return [
    { role: 'system', content: p.system },
    {
      role: 'user',
      content: p.expandBody(context, count, node.text, avoid)
    }
  ]
}

export function buildRephraseMessages(node: MindNode, instruction: string): ChatMessage[] {
  const p = P()
  return [
    { role: 'system', content: p.system },
    {
      role: 'user',
      content: p.rephrase(node.text, instruction)
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
  const p = P()
  return [
    { role: 'system', content: p.system },
    {
      role: 'user',
      content: p.explain(path.join(' › '), node.text)
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
  const p = P()
  const avoid = existing.length > 0 ? p.deepAvoid(existing.map((e) => `"${e}"`).join(', ')) : ''
  return [
    { role: 'system', content: p.system },
    {
      role: 'user',
      content: p.deepBody(path.join(' › '), node.text, breadth, sub, avoid)
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
