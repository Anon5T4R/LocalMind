import type { ChatMessage } from '../../shared/types'

// node-llama-cpp v3 is pure ESM; we load it lazily via dynamic import so the
// CJS main bundle starts fast and only pays the native-load cost on first use.
type LlamaModule = typeof import('node-llama-cpp')

interface GenerateOpts {
  temperature: number
  onText: (delta: string) => void
  signal?: AbortSignal
  /** When set, output is constrained to valid JSON of this schema. */
  jsonSchema?: Record<string, unknown>
}

export class LocalEngine {
  private mod: LlamaModule | null = null
  private llama: Awaited<ReturnType<LlamaModule['getLlama']>> | null = null
  private model: any = null
  private context: any = null
  private loadedPath: string | null = null
  private loadingPromise: Promise<void> | null = null
  private busy = false

  status() {
    return {
      loaded: Boolean(this.model) && Boolean(this.loadedPath),
      modelPath: this.loadedPath ?? undefined,
      loading: Boolean(this.loadingPromise)
    }
  }

  private async getModule(): Promise<LlamaModule> {
    if (!this.mod) {
      this.mod = (await import('node-llama-cpp')) as LlamaModule
    }
    return this.mod
  }

  /** Free the loaded model and context (releases RAM/VRAM). */
  async unload(): Promise<void> {
    if (this.loadingPromise) {
      try {
        await this.loadingPromise
      } catch {
        /* ignore */
      }
    }
    try {
      await this.context?.dispose?.()
    } catch {
      /* ignore */
    }
    try {
      await this.model?.dispose?.()
    } catch {
      /* ignore */
    }
    this.context = null
    this.model = null
    this.loadedPath = null
  }

  async ensureLoaded(
    modelPath: string,
    contextSize: number,
    gpuLayers: number,
    onProgress?: (phase: 'load' | 'context', progress: number) => void
  ): Promise<void> {
    if (this.loadedPath === modelPath && this.model) return
    if (this.loadingPromise) await this.loadingPromise

    this.loadingPromise = (async () => {
      const mod = await this.getModule()
      if (!this.llama) this.llama = await mod.getLlama()

      // Dispose previous model if switching.
      if (this.model) {
        try {
          await this.context?.dispose?.()
          await this.model?.dispose?.()
        } catch {
          /* ignore */
        }
        this.model = null
        this.context = null
        this.loadedPath = null
      }

      this.model = await this.llama.loadModel({
        modelPath,
        ...(gpuLayers >= 0 ? { gpuLayers } : {}),
        onLoadProgress: (p: number) => onProgress?.('load', p)
      })
      onProgress?.('context', 0)
      this.context = await this.model.createContext({ contextSize })
      onProgress?.('context', 1)
      this.loadedPath = modelPath
    })()

    try {
      await this.loadingPromise
    } finally {
      this.loadingPromise = null
    }
  }

  async generate(messages: ChatMessage[], opts: GenerateOpts): Promise<string> {
    if (!this.model || !this.context) {
      throw new Error('Modelo local não carregado.')
    }
    if (this.busy) {
      throw new Error('O motor local está ocupado com outra geração.')
    }
    this.busy = true
    try {
      const mod = await this.getModule()
      const system = messages.find((m) => m.role === 'system')?.content
      const userTurns = messages
        .filter((m) => m.role !== 'system')
        .map((m) => m.content)
        .join('\n\n')

      // Grab a sequence from the context pool. The default context has a single
      // sequence, so it MUST be released after each generation or the next call
      // throws "No sequences left".
      const sequence = this.context.getSequence()
      const session = new mod.LlamaChatSession({
        contextSequence: sequence,
        ...(system ? { systemPrompt: system } : {})
      })

      try {
        // Constrain output to valid JSON when a schema is provided. This both
        // guarantees parseable JSON and suppresses "thinking" output that
        // reasoning models would otherwise emit (and that we'd never see).
        let grammar: unknown
        if (opts.jsonSchema && this.llama) {
          try {
            grammar = await this.llama.createGrammarForJsonSchema(opts.jsonSchema as never)
          } catch {
            grammar = undefined
          }
        }

        // Accumulate every segment (including reasoning) as a fallback for
        // models that route everything through a thought channel.
        let full = ''
        const text = await session.prompt(userTurns, {
          temperature: opts.temperature,
          maxTokens: 1400,
          signal: opts.signal,
          ...(grammar ? { grammar: grammar as never } : {}),
          onResponseChunk: (chunk: { text: string }) => {
            full += chunk.text
          },
          onTextChunk: (chunk: string) => opts.onText(chunk)
        })
        return text && text.trim() ? text : full
      } finally {
        try {
          session.dispose?.()
        } catch {
          /* ignore */
        }
        try {
          sequence.dispose?.()
        } catch {
          /* ignore */
        }
      }
    } finally {
      this.busy = false
    }
  }
}

export const localEngine = new LocalEngine()
