import { nanoid } from 'nanoid'
import type { ChatMessage, EngineKind } from '@shared/types'

interface RunOptions {
  onText?: (delta: string, full: string) => void
  engine?: EngineKind
  temperature?: number
  json?: boolean
  jsonSchema?: Record<string, unknown>
  signal?: AbortSignal
}

// Single set of listeners shared by all in-flight requests.
const pending = new Map<
  string,
  { full: string; opts: RunOptions; resolve: (t: string) => void; reject: (e: Error) => void }
>()

let wired = false
function ensureWired(): void {
  if (wired) return
  wired = true
  window.taylormind.onChunk(({ requestId, delta }) => {
    const p = pending.get(requestId)
    if (!p) return
    p.full += delta
    p.opts.onText?.(delta, p.full)
  })
  window.taylormind.onDone(({ requestId, text, error }) => {
    const p = pending.get(requestId)
    if (!p) return
    pending.delete(requestId)
    if (error) p.reject(new Error(error))
    else p.resolve(text || p.full)
  })
}

export function runAI(messages: ChatMessage[], opts: RunOptions = {}): Promise<string> {
  ensureWired()
  const requestId = nanoid(10)
  return new Promise<string>((resolve, reject) => {
    pending.set(requestId, { full: '', opts, resolve, reject })
    if (opts.signal) {
      opts.signal.addEventListener('abort', () => {
        window.taylormind.cancel(requestId)
      })
    }
    window.taylormind
      .generate({
        requestId,
        messages,
        engine: opts.engine,
        temperature: opts.temperature,
        json: opts.json,
        jsonSchema: opts.jsonSchema
      })
      .catch((e) => {
        pending.delete(requestId)
        reject(e instanceof Error ? e : new Error(String(e)))
      })
  })
}
