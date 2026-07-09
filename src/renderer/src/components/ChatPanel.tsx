import { useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { runAI } from '../ai/client'
import { parseOutlineToNodes } from '../ai/prompts'
import { useMap } from '../store'
import type { ChatMessage } from '@shared/types'

const CHAT_SYSTEM =
  'Você é um assistente dentro de um app de mapas mentais (LocalMind). ' +
  'Responda em português do Brasil, de forma clara e organizada. ' +
  'Use listas e tópicos quando ajudar. Pode sugerir estruturas de mapa mental.'

interface Msg {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  onClose: () => void
}

export function ChatPanel({ onClose }: Props): JSX.Element {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [width, setWidth] = useState(400)
  const abortRef = useRef<AbortController | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const addChild = useMap((s) => s.addChild)
  const addNodes = useMap((s) => s.addNodes)
  const rootId = useMap((s) => s.rootId)
  const selectedId = useMap((s) => s.selectedId)

  // Show local model load progress in the composer.
  useEffect(() => {
    return window.localmind.onLoadProgress(({ progress, phase }) => {
      setStatus(
        phase === 'context'
          ? progress >= 1
            ? ''
            : 'Preparando contexto…'
          : `Carregando modelo… ${Math.round(progress * 100)}%`
      )
    })
  }, [])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const send = async (): Promise<void> => {
    const text = input.trim()
    if (!text || busy) return
    const userMsg: Msg = { id: nanoid(6), role: 'user', content: text }
    const assistantId = nanoid(6)
    setMessages((m) => [...m, userMsg, { id: assistantId, role: 'assistant', content: '' }])
    setInput('')
    setBusy(true)
    setStatus('')

    const history: ChatMessage[] = [
      { role: 'system', content: CHAT_SYSTEM },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: text }
    ]
    const controller = new AbortController()
    abortRef.current = controller
    try {
      await runAI(history, {
        signal: controller.signal,
        onText: (_delta, full) => {
          setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, content: full } : x)))
        }
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setMessages((m) =>
        m.map((x) =>
          x.id === assistantId && !x.content ? { ...x, content: '⚠ ' + msg } : x
        )
      )
    } finally {
      setBusy(false)
      setStatus('')
      abortRef.current = null
    }
  }

  const startResize = (e: React.PointerEvent): void => {
    e.preventDefault()
    const onMove = (ev: PointerEvent): void => {
      setWidth(Math.max(320, Math.min(900, window.innerWidth - ev.clientX)))
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const copy = (text: string): void => {
    navigator.clipboard.writeText(text)
  }

  const insertAsNode = (text: string): void => {
    const parent = selectedId ?? rootId()
    // First line / trimmed becomes the node text.
    const label = text.split('\n')[0].slice(0, 80).trim() || text.slice(0, 80)
    addChild(parent, label, false)
  }

  const insertAsSubtree = (text: string): void => {
    const parent = selectedId ?? rootId()
    const nodes = parseOutlineToNodes(text, parent, () => nanoid(8))
    if (nodes.length === 0) insertAsNode(text)
    else addNodes(nodes, parent)
  }

  return (
    <aside className="chat-panel" style={{ width }}>
      <span className="chat-resize" onPointerDown={startResize} title="Arraste para redimensionar" />
      <div className="chat-head">
        <span>💬 Chat com IA</span>
        <div className="chat-head-actions">
          <button onClick={() => setWidth((w) => (w < 600 ? 760 : 400))} title="Ampliar / reduzir">
            ⤢
          </button>
          <button onClick={() => setMessages([])} title="Limpar conversa">
            🧹
          </button>
          <button onClick={onClose} title="Fechar">
            ✕
          </button>
        </div>
      </div>

      <div className="chat-body" ref={bodyRef}>
        {messages.length === 0 && (
          <p className="chat-empty">
            Converse com a IA (usa o mesmo motor configurado). Peça ideias, estruturas, textos — e
            copie ou insira no mapa.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.role}`}>
            <div className="chat-bubble">{m.content || '…'}</div>
            {m.role === 'assistant' && m.content && (
              <div className="chat-msg-actions">
                <button onClick={() => copy(m.content)}>Copiar</button>
                <button onClick={() => insertAsNode(m.content)} title="Adiciona como 1 nó filho do selecionado">
                  ＋ nó
                </button>
                <button
                  onClick={() => insertAsSubtree(m.content)}
                  title="Insere a resposta inteira como sub-árvore (entende listas/tópicos)"
                >
                  ＋ ramo
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="chat-composer">
        {status && <div className="chat-status">{status}</div>}
        <textarea
          rows={2}
          placeholder="Escreva uma mensagem… (Enter envia, Shift+Enter quebra linha)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <div className="chat-composer-actions">
          {busy ? (
            <button onClick={() => abortRef.current?.abort()}>Parar</button>
          ) : (
            <button className="primary" onClick={send} disabled={!input.trim()}>
              Enviar
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
