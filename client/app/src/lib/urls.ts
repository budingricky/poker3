export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  return `http://${trimmed}`
}

export function toWsUrl(httpBaseUrl: string): string {
  return httpBaseUrl.replace(/^http/i, 'ws') + '/ws'
}

