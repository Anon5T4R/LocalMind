import { useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { runAI } from '../ai/client'
import { parseOutlineToNodes } from '../ai/prompts'
import { useMap } from '../store'
import type { ChatMessage } from '@shared/types'
import { t } from '../lib/i18n'

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
            : t('common.preparingContext')
          : t('chat.loadingModel', { pct: Math.round(progress * 100) })
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
      { role: 'system', content: t('chat.system') },
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
      <span className="chat-resize" onPointerDown={startResize} title={t('chat.resizePanel.title')} />
      <div className="chat-head">
        <span>💬 {t('chat.title')}</span>
        <div className="chat-head-actions">
          <button onClick={() => setWidth((w) => (w < 600 ? 760 : 400))} title={t('chat.resize.title')}>
            ⤢
          </button>
          <button onClick={() => setMessages([])} title={t('chat.clear')}>
            🧹
          </button>
          <button onClick={onClose} title={t('common.close')}>
            ✕
          </button>
        </div>
      </div>

      <div className="chat-body" ref={bodyRef}>
        {messages.length === 0 && <p className="chat-empty">{t('chat.empty')}</p>}
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.role}`}>
            <div className="chat-bubble">{m.content || '…'}</div>
            {m.role === 'assistant' && m.content && (
              <div className="chat-msg-actions">
                <button onClick={() => copy(m.content)}>{t('chat.copy')}</button>
                <button onClick={() => insertAsNode(m.content)} title={t('chat.asNode.title')}>
                  {t('chat.asNode')}
                </button>
                <button onClick={() => insertAsSubtree(m.content)} title={t('chat.asBranch.title')}>
                  {t('chat.asBranch')}
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
          placeholder={t('chat.composer.placeholder')}
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
            <button onClick={() => abortRef.current?.abort()}>{t('chat.stop')}</button>
          ) : (
            <button className="primary" onClick={send} disabled={!input.trim()}>
              {t('chat.send')}
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
