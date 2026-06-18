import type { ChatMessage, EngineKind, AppSettings } from '../../shared/types'

interface GenerateOpts {
  temperature: number
  onText: (delta: string) => void
  signal?: AbortSignal
}

function splitSystem(messages: ChatMessage[]): { system?: string; rest: ChatMessage[] } {
  const system = messages.find((m) => m.role === 'system')?.content
  const rest = messages.filter((m) => m.role !== 'system')
  return { system, rest }
}

async function generateAnthropic(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  opts: GenerateOpts
): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey })
  const { system, rest } = splitSystem(messages)
  let full = ''
  const stream = client.messages.stream(
    {
      model,
      max_tokens: 4096,
      temperature: opts.temperature,
      ...(system ? { system } : {}),
      messages: rest.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    },
    { signal: opts.signal }
  )
  stream.on('text', (delta: string) => {
    full += delta
    opts.onText(delta)
  })
  await stream.finalMessage()
  return full
}

async function generateOpenAI(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  opts: GenerateOpts,
  baseURL?: string
): Promise<string> {
  const { default: OpenAI } = await import('openai')
  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) })
  let full = ''
  const stream = await client.chat.completions.create(
    {
      model,
      temperature: opts.temperature,
      stream: true,
      messages: messages.map((m) => ({ role: m.role, content: m.content }))
    },
    { signal: opts.signal }
  )
  for await (const part of stream) {
    const delta = part.choices[0]?.delta?.content ?? ''
    if (delta) {
      full += delta
      opts.onText(delta)
    }
  }
  return full
}

async function generateGemini(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  opts: GenerateOpts
): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  const { system, rest } = splitSystem(messages)
  const gen = genAI.getGenerativeModel({
    model,
    ...(system ? { systemInstruction: system } : {})
  })
  let full = ''
  const result = await gen.generateContentStream(
    {
      contents: rest.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      })),
      generationConfig: { temperature: opts.temperature }
    },
    { signal: opts.signal }
  )
  for await (const chunk of result.stream) {
    const delta = chunk.text()
    if (delta) {
      full += delta
      opts.onText(delta)
    }
  }
  return full
}

export async function generateRemote(
  engine: Exclude<EngineKind, 'local'>,
  apiKey: string,
  settings: AppSettings,
  messages: ChatMessage[],
  opts: GenerateOpts
): Promise<string> {
  switch (engine) {
    case 'anthropic':
      return generateAnthropic(apiKey, settings.anthropic.model, messages, opts)
    case 'openai':
      return generateOpenAI(apiKey, settings.openai.model, messages, opts)
    case 'gemini':
      return generateGemini(apiKey, settings.gemini.model, messages, opts)
    case 'openai-compatible':
      return generateOpenAI(
        apiKey || 'not-needed',
        settings.openaiCompatible.model,
        messages,
        opts,
        settings.openaiCompatible.baseUrl
      )
    default:
      throw new Error(`Provedor desconhecido: ${engine}`)
  }
}
