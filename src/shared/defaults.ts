import type { AppSettings } from './types'

/** Where we scan for local .gguf models by default (the user's LM Studio hub). */
export const DEFAULT_MODEL_DIRS = [
  'D:\\LocalAIModels\\.lmstudio\\hub\\models'
]

export const DEFAULT_SETTINGS: AppSettings = {
  engine: 'local',
  localModelPath: undefined,
  localContextSize: 4096,
  localGpuLayers: -1,
  anthropic: { model: 'claude-opus-4-8' },
  openai: { model: 'gpt-4o' },
  gemini: { model: 'gemini-2.5-flash' },
  openaiCompatible: { baseUrl: 'http://localhost:1234/v1', model: 'local-model' },
  temperature: 0.7
}
