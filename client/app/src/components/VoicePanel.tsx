import React, { useEffect, useRef } from 'react'

type VoiceState = {
  micEnabled: boolean
  setMicEnabled?: React.Dispatch<React.SetStateAction<boolean>>
  toggleMic: () => void
  micPermission: 'idle' | 'granted' | 'denied'
  remoteStreams: Record<string, any>
  speakingLevels: Record<string, number>
  error?: string | null
  status?: 'idle' | 'initializing' | 'joined' | 'error'
}

type PlayerLite = { id: string; name: string }

export default function VoicePanel({
  voice,
  players,
  selfId,
  variant = 'dark',
}: {
  voice: VoiceState
  players: PlayerLite[]
  selfId: string
  variant?: 'dark' | 'light'
}) {
  const playedRefs = useRef<Set<string>>(new Set())

  const getLabel = () => {
    if (voice.status === 'initializing') return '⏳'
    if (voice.status === 'error') return '⚠️ 重试'
    if (voice.micPermission === 'denied') return '🎤 无权限'
    return voice.micEnabled ? '🎤 开' : '🎤 关'
  }

  const getTitle = () => {
    if (voice.status === 'initializing') return '正在连接语音服务器...'
    if (voice.error) return `错误: ${voice.error} (点击重试)`
    if (voice.micPermission === 'denied') return '浏览器未授予麦克风权限（请检查 HTTPS 或浏览器设置）'
    return voice.micEnabled ? '点击关闭麦克风' : '点击开启麦克风'
  }

  const buttonClass =
    variant === 'light'
      ? [
          'rounded-full text-sm font-bold px-4 py-2 border transition-all',
          voice.status === 'initializing'
            ? 'bg-yellow-100 border-yellow-200 text-yellow-600 animate-pulse'
            : voice.status === 'error'
              ? 'bg-red-100 border-red-200 text-red-600'
              : voice.micPermission === 'denied'
                ? 'bg-gray-200 border-gray-200 text-gray-500'
                : voice.micEnabled
                  ? 'bg-green-600 hover:bg-green-700 border-green-700 text-white'
                  : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700',
        ].join(' ')
      : [
          'rounded-full text-sm font-bold px-4 py-2 border transition-all',
          voice.status === 'initializing'
            ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-200 animate-pulse'
            : voice.status === 'error'
              ? 'bg-red-500/20 border-red-500/30 text-red-200'
              : voice.micPermission === 'denied'
                ? 'bg-gray-200 border-gray-200 text-gray-500'
                : voice.micEnabled
                  ? 'bg-green-600 hover:bg-green-700 border-green-700 text-white'
                  : 'bg-white/10 hover:bg-white/15 border-white/20 text-white',
        ].join(' ')

  const speakingThreshold = 0.08
  const speakingPlayers = players
    .map(p => ({ ...p, lvl: Number(voice.speakingLevels?.[p.id]) || 0 }))
    .filter(p => p.lvl > speakingThreshold)
    .sort((a, b) => b.lvl - a.lvl)

  const speakingText = (() => {
    if (speakingPlayers.length === 0) return ''
    const names = speakingPlayers.slice(0, 2).map(p => p.name)
    const suffix = speakingPlayers.length > 2 ? ` 等${speakingPlayers.length}人` : ''
    return `${names.join('、')}${suffix} 正在说话`
  })()

  // Handle TRTC stream playing
  useEffect(() => {
    Object.entries(voice.remoteStreams).forEach(([pid, stream]) => {
      if (stream && typeof stream.play === 'function') {
         // It's a TRTC stream
         if (!playedRefs.current.has(pid)) {
             // We need a DOM element. The mapped div below provides it via ref or ID?
             // TRTC stream.play() takes an element ID or element.
             // We can let the div ref handle it.
         }
      }
    })
  }, [voice.remoteStreams])

  return (
    <div className="flex items-center gap-3">
      {Object.entries(voice.remoteStreams).map(([pid, stream]) => (
        <div
            key={pid}
            className="hidden"
            ref={el => {
                if (!el) return;
                if (stream && typeof stream.play === 'function') {
                    // TRTC Stream
                    if (!playedRefs.current.has(pid)) {
                        stream.play(el).then(() => {
                            playedRefs.current.add(pid)
                        }).catch((e: any) => {
                            console.error('Play failed', e)
                        })
                    }
                } else if (stream instanceof MediaStream) {
                    // Native WebRTC fallback (if ever needed)
                    // Create audio element if not exists?
                    // Not implemented here to keep clean for TRTC
                }
            }}
        />
      ))}
      
      <button
        type="button"
        onClick={() => voice.toggleMic()}
        className={buttonClass}
        disabled={voice.status === 'initializing' || voice.micPermission === 'denied'}
        title={getTitle()}
      >
        {getLabel()}
      </button>

      {speakingText ? (
        <div className={['hidden md:block text-[12px] font-semibold', variant === 'light' ? 'text-slate-700' : 'text-white/80'].join(' ')}>
          {speakingText}
        </div>
      ) : null}
      
      {voice.error && (
          <div className="text-red-500 text-xs" title={voice.error}>⚠️</div>
      )}
    </div>
  )
}
