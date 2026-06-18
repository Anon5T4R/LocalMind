import type {
  GenerateRequest,
  StreamChunk,
  StreamDone,
  LoadProgress
} from '../../shared/types'
import { getSettings, getApiKey } from '../settings'
import { localEngine } from './local'
import { generateRemote } from './remote'

type Sender = (
  channel: 'ai:chunk' | 'ai:done' | 'ai:loadprogress',
  payload: StreamChunk | StreamDone | LoadProgress
) => void

const inFlight = new Map<string, AbortController>()

export function cancelGenerate(requestId: string): void {
  inFlight.get(requestId)?.abort()
}

export function localEngineStatus() {
  return localEngine.status()
}

export async function unloadLocalModel(): Promise<void> {
  await localEngine.unload()
}

/** Explicitly load the configured local model, reporting progress via `send`. */
export async function loadLocalModel(send: Sender): Promise<{ ok: boolean; error?: string }> {
  const settings = getSettings()
  if (!settings.localModelPath) {
    return { ok: false, error: 'Nenhum modelo local selecionado.' }
  }
  try {
    await localEngine.ensureLoaded(
      settings.localModelPath,
      settings.localContextSize,
      settings.localGpuLayers,
      (phase, progress) => send('ai:loadprogress', { requestId: 'manual', phase, progress })
    )
    return { ok: true }
  } catch (err) {
    console.error('[ai:load] falhou:', err)
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function runGenerate(req: GenerateRequest, send: Sender): Promise<void> {
  const settings = getSettings()
  const engine = req.engine ?? settings.engine
  const temperature = req.temperature ?? settings.temperature
  const controller = new AbortController()
  inFlight.set(req.requestId, controller)

  const onText = (delta: string): void => {
    send('ai:chunk', { requestId: req.requestId, delta })
  }

  let text = ''
  let error: string | undefined
  try {
    if (engine === 'local') {
      if (!settings.localModelPath) {
        throw new Error('Nenhum modelo local selecionado. Escolha um .gguf nas Configurações.')
      }
      await localEngine.ensureLoaded(
        settings.localModelPath,
        settings.localContextSize,
        settings.localGpuLayers,
        (phase, progress) =>
          send('ai:loadprogress', { requestId: req.requestId, phase, progress })
      )
      text = await localEngine.generate(req.messages, {
        temperature,
        onText,
        signal: controller.signal,
        jsonSchema: req.jsonSchema
      })
    } else {
      const apiKey = getApiKey(engine)
      if (!apiKey && engine !== 'openai-compatible') {
        throw new Error(`Sem API key para ${engine}. Configure nas Configurações.`)
      }
      text = await generateRemote(engine, apiKey ?? '', settings, req.messages, {
        temperature,
        onText,
        signal: controller.signal
      })
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
    // Surface the full stack in the dev terminal for diagnostics.
    console.error('[ai:generate] falhou:', err)
  } finally {
    inFlight.delete(req.requestId)
    send('ai:done', { requestId: req.requestId, text, error })
  }
}
