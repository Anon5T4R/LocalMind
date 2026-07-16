import { useCallback, useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useMap, createEmptyMap } from '../store'
import { runAI } from './client'
import {
  buildGenerateMapMessages,
  buildExpandMessages,
  buildRephraseMessages,
  buildDeepExpandMessages,
  buildExplainMessages,
  extractJson,
  treeToNodes,
  deepToNodes,
  allTexts,
  nodePath,
  mapSchema,
  expandSchema,
  rephraseSchema,
  deepExpandSchema,
  explainSchema,
  type TreeNodeJson
} from './prompts'
import type { MindMap } from '@shared/types'
import { t } from '../lib/i18n'

export interface AiActions {
  busy: boolean
  statusText: string
  error: string | null
  generateMap: (topic: string, depth?: number, breadth?: number) => Promise<void>
  expandNode: (nodeId: string, count?: number) => Promise<void>
  deepExpandNode: (nodeId: string) => Promise<void>
  explainNode: (nodeId: string) => Promise<void>
  rephraseNode: (nodeId: string, instruction: string) => Promise<void>
  cancel: () => void
  clearError: () => void
}

export function useAiActions(): AiActions {
  const [busy, setBusy] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const baseStatus = useRef('')

  // While a local GGUF loads, surface real progress so the user can see it work.
  useEffect(() => {
    return window.localmind.onLoadProgress(({ progress, phase }) => {
      if (phase === 'context') {
        setStatusText(
          progress >= 1 ? baseStatus.current || t('gen.generating') : t('common.preparingContext')
        )
      } else {
        setStatusText(t('chat.loadingModel', { pct: Math.round(progress * 100) }))
      }
    })
  }, [])

  const run = useCallback(
    async <T,>(status: string, fn: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> => {
      const controller = new AbortController()
      abortRef.current = controller
      baseStatus.current = status
      setBusy(true)
      setStatusText(status)
      setError(null)
      try {
        return await fn(controller.signal)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.toLowerCase().includes('abort')) {
          setError(null)
        } else {
          setError(msg)
        }
        return undefined
      } finally {
        setBusy(false)
        setStatusText('')
        abortRef.current = null
      }
    },
    []
  )

  const generateMap = useCallback(
    async (topic: string, depth = 2, breadth = 4) => {
      await run(t('ai.status.generatingMap'), async (signal) => {
        const text = await runAI(buildGenerateMapMessages(topic, depth, breadth), {
          json: true,
          jsonSchema: mapSchema(depth),
          signal,
          onText: () => setStatusText(t('ai.status.generatingMap'))
        })
        const tree = extractJson<TreeNodeJson>(text)
        const nodes = treeToNodes(tree, null, () => nanoid(8))
        if (nodes.length === 0) throw new Error(t('ai.err.noNodes'))
        const map: MindMap = {
          ...createEmptyMap(),
          title: topic.slice(0, 60),
          nodes
        }
        useMap.getState().setMap(map)
      })
    },
    [run]
  )

  const expandNode = useCallback(
    async (nodeId: string, count = 5) => {
      const state = useMap.getState()
      const node = state.getNode(nodeId)
      if (!node) return
      const path = nodePath(state.map, nodeId)
      // Global context: every other node's text, so it doesn't duplicate
      // anything already present anywhere in the map.
      const existing = allTexts(state.map, new Set([nodeId]))
      await run(t('ai.status.expanding', { text: node.text }), async (signal) => {
        const text = await runAI(buildExpandMessages(node, path, existing, count), {
          json: true,
          jsonSchema: expandSchema,
          signal
        })
        const parsed = extractJson<{ items: string[] }>(text)
        const items = (parsed.items ?? []).filter((s) => typeof s === 'string' && s.trim())
        if (items.length === 0) throw new Error(t('ai.err.noSubtopics'))
        useMap.getState().addChildren(nodeId, items)
        // Make sure the expanded node is visible (uncollapse).
        if (useMap.getState().getNode(nodeId)?.collapsed) {
          useMap.getState().toggleCollapse(nodeId)
        }
      })
    },
    [run]
  )

  const deepExpandNode = useCallback(
    async (nodeId: string) => {
      const state = useMap.getState()
      const node = state.getNode(nodeId)
      if (!node) return
      const path = nodePath(state.map, nodeId)
      const existing = allTexts(state.map, new Set([nodeId]))
      await run(t('ai.status.deepExpanding', { text: node.text }), async (signal) => {
        const text = await runAI(buildDeepExpandMessages(node, path, existing), {
          json: true,
          jsonSchema: deepExpandSchema,
          signal
        })
        const data = extractJson<{ children?: { text: string; children?: { text: string }[] }[] }>(
          text
        )
        const nodes = deepToNodes(data, nodeId, () => nanoid(8))
        if (nodes.length === 0) throw new Error(t('ai.err.nothing'))
        useMap.getState().addNodes(nodes, nodeId)
      })
    },
    [run]
  )

  const explainNode = useCallback(
    async (nodeId: string) => {
      const state = useMap.getState()
      const node = state.getNode(nodeId)
      if (!node) return
      const path = nodePath(state.map, nodeId)
      await run(t('ai.status.explaining', { text: node.text }), async (signal) => {
        const text = await runAI(buildExplainMessages(node, path), {
          json: true,
          jsonSchema: explainSchema,
          signal
        })
        const parsed = extractJson<{ text: string }>(text)
        if (parsed.text?.trim()) useMap.getState().addChild(nodeId, parsed.text.trim(), false)
      })
    },
    [run]
  )

  const rephraseNode = useCallback(
    async (nodeId: string, instruction: string) => {
      const state = useMap.getState()
      const node = state.getNode(nodeId)
      if (!node) return
      await run(t('ai.status.rephrasing'), async (signal) => {
        const text = await runAI(buildRephraseMessages(node, instruction), {
          json: true,
          jsonSchema: rephraseSchema,
          signal
        })
        const parsed = extractJson<{ text: string }>(text)
        if (parsed.text?.trim()) useMap.getState().updateText(nodeId, parsed.text.trim())
      })
    },
    [run]
  )

  const cancel = useCallback(() => abortRef.current?.abort(), [])
  const clearError = useCallback(() => setError(null), [])

  return {
    busy,
    statusText,
    error,
    generateMap,
    expandNode,
    deepExpandNode,
    explainNode,
    rephraseNode,
    cancel,
    clearError
  }
}
