export type DeepSeekRole = 'system' | 'user' | 'assistant'

export interface DeepSeekMessage {
  role: DeepSeekRole
  content: string
}

export async function deepseekChat(params: {
  apiKey: string
  messages: DeepSeekMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}) {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model || 'deepseek-chat',
      messages: params.messages,
      stream: false,
      temperature: typeof params.temperature === 'number' ? params.temperature : 0.2,
      max_tokens: typeof params.maxTokens === 'number' ? params.maxTokens : 256,
    }),
    signal: params.signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`DeepSeek API error: ${res.status} ${text}`.slice(0, 300))
  }

  const data: any = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new Error('DeepSeek API returned empty content')
  return content
}

export async function verifyDeepseekApiKey(params: { apiKey: string; signal?: AbortSignal }) {
  const content = await deepseekChat({
    apiKey: params.apiKey,
    model: 'deepseek-chat',
    temperature: 0,
    maxTokens: 32,
    messages: [
      { role: 'system', content: 'Reply with a single word: OK' },
      { role: 'user', content: 'OK' },
    ],
    signal: params.signal,
  })
  if (!String(content || '').toUpperCase().includes('OK')) {
    throw new Error('DeepSeek API 校验失败：返回内容异常')
  }
}

export function tryParseJsonObject(text: string): any | null {
  try {
    return JSON.parse(text)
  } catch {
  }
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const slice = text.slice(start, end + 1)
    try {
      return JSON.parse(slice)
    } catch {
    }
  }
  return null
}
