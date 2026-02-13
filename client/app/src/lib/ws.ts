import { toWsUrl } from './urls'

export type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export function createPokerWs(baseUrl: string) {
  const url = toWsUrl(baseUrl)
  const ws = new WebSocket(url)
  return ws
}

