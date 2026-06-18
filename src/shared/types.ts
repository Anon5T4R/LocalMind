// Shared types between main, preload and renderer.

/** A single node in the mind map. Parent/child relationships form a tree. */
export interface MindNode {
  id: string
  text: string
  /** null for the single root node. */
  parentId: string | null
  collapsed?: boolean
  /** optional accent color (hex) for the node card. */
  color?: string
  /** free-form note attached to the node. */
  note?: string
  /** custom card width in px (defaults to the layout constant). */
  width?: number
  /** custom font size in px. */
  fontSize?: number
  /**
   * Which direction from the root this node's subtree grows. Only meaningful for
   * the root's direct children; descendants inherit. Undefined = auto-balance
   * (left/right). 'up'/'down' are only set explicitly by the user.
   */
  side?: 'left' | 'right' | 'up' | 'down'
}

export interface MindMap {
  id: string
  title: string
  nodes: MindNode[]
  createdAt: number
  updatedAt: number
}

export type EngineKind = 'local' | 'anthropic' | 'openai' | 'gemini' | 'openai-compatible'

export interface RemoteProviderConfig {
  /** Only used for openai-compatible. */
  baseUrl?: string
  model: string
}

export interface AppSettings {
  engine: EngineKind
  /** Absolute path to a .gguf file for the local engine. */
  localModelPath?: string
  /** llama.cpp context size for the local engine. */
  localContextSize: number
  /** Number of layers to offload to GPU. -1 = auto/max. */
  localGpuLayers: number
  anthropic: RemoteProviderConfig
  openai: RemoteProviderConfig
  gemini: RemoteProviderConfig
  openaiCompatible: RemoteProviderConfig
  /** Default temperature for generations. */
  temperature: number
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GenerateRequest {
  /** Stable id so the renderer can correlate streaming chunks. */
  requestId: string
  messages: ChatMessage[]
  /** Override the configured engine for this request. */
  engine?: EngineKind
  temperature?: number
  /** Hint to the local engine that we want strict JSON back. */
  json?: boolean
  /**
   * Optional JSON schema (GBNF-compatible) used to constrain the LOCAL engine's
   * output to valid JSON of this shape. Ignored by remote providers for now.
   */
  jsonSchema?: Record<string, unknown>
}

export interface StreamChunk {
  requestId: string
  delta: string
}

export interface StreamDone {
  requestId: string
  /** Full accumulated text. */
  text: string
  error?: string
}

/** Local model file load progress (0..1) emitted while a GGUF is loading. */
export interface LoadProgress {
  requestId: string
  /** 0..1 file load fraction. */
  progress: number
  /** 'load' while reading the model file, 'context' while preparing inference. */
  phase: 'load' | 'context'
}

/** Info about a discovered local GGUF model. */
export interface LocalModelInfo {
  path: string
  name: string
  sizeBytes: number
  /** true if it's an mmproj/embedding sidecar, not a chat model. */
  isSidecar: boolean
}

/** API exposed to the renderer via the preload bridge. */
export interface TaylorMindApi {
  // Settings
  getSettings(): Promise<AppSettings>
  setSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  // API keys (stored encrypted via safeStorage, never returned in full)
  setApiKey(provider: Exclude<EngineKind, 'local'>, key: string): Promise<void>
  hasApiKey(provider: Exclude<EngineKind, 'local'>): Promise<boolean>
  // Local models
  listLocalModels(): Promise<LocalModelInfo[]>
  pickModelFile(): Promise<string | null>
  // Map persistence
  openMap(): Promise<{ path: string; map: MindMap } | null>
  saveMap(map: MindMap, path?: string): Promise<string | null>
  exportFile(
    data: string,
    base64: boolean,
    defaultName: string,
    filters: { name: string; extensions: string[] }[]
  ): Promise<string | null>
  // Generation (streaming via events)
  generate(req: GenerateRequest): Promise<void>
  cancel(requestId: string): Promise<void>
  onChunk(cb: (chunk: StreamChunk) => void): () => void
  onDone(cb: (done: StreamDone) => void): () => void
  onLoadProgress(cb: (p: LoadProgress) => void): () => void
  // Engine status
  localEngineStatus(): Promise<{ loaded: boolean; modelPath?: string; loading: boolean }>
  loadLocalModel(): Promise<{ ok: boolean; error?: string }>
  unloadLocalModel(): Promise<void>
}
