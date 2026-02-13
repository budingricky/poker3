import React from 'react'

type VoiceState = {
  micEnabled: boolean
  setMicEnabled: React.Dispatch<React.SetStateAction<boolean>>
  toggleMic?: () => void
  micPermission: 'idle' | 'granted' | 'denied'
  remoteStreams: Record<string, MediaStream>
  speakingLevels: Record<string, number>
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
  const audioRefs = React.useRef(new Map<string, HTMLAudioElement>())
  const [audioUnlocked, setAudioUnlocked] = React.useState(false)

  const getLabel = () => {
    if (voice.micPermission === 'denied') return '🎤 无权限'
    return voice.micEnabled ? '🎤 开' : '🎤 关'
  }

  const getTitle = () => {
    if (voice.micPermission === 'denied') return '浏览器未授予麦克风权限（局域网 IP 访问通常需要 HTTPS）'
    return voice.micEnabled ? '点击关闭麦克风' : '点击开启麦克风'
  }

  const buttonClass =
    variant === 'light'
      ? [
          'rounded-full text-sm font-bold px-4 py-2 border',
          voice.micPermission === 'denied'
            ? 'bg-gray-200 border-gray-200 text-gray-500'
            : voice.micEnabled
              ? 'bg-green-600 hover:bg-green-700 border-green-700 text-white'
              : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700',
        ].join(' ')
      : [
          'rounded-full text-sm font-bold px-4 py-2 border',
          voice.micPermission === 'denied'
            ? 'bg-gray-200 border-gray-200 text-gray-500'
            : voice.micEnabled
              ? 'bg-green-600 hover:bg-green-700 border-green-700 text-white'
              : 'bg-white/10 hover:bg-white/15 border-white/20 text-white',
        ].join(' ')

  const pillClass = (speaking: boolean) => {
    if (variant === 'light') return speaking ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
    return speaking ? 'border-green-400 bg-green-500/15' : 'border-white/10 bg-black/10'
  }

  const nameClass = (isSelf: boolean) => {
    if (variant === 'light') return isSelf ? 'text-amber-700' : 'text-slate-700'
    return isSelf ? 'text-yellow-200' : 'text-white/80'
  }

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

  return (
    <div className="flex items-center gap-3">
      {Object.entries(voice.remoteStreams).map(([pid, stream]) => (
        <audio
          key={pid}
          autoPlay
          playsInline
          ref={el => {
            if (!el) return
            audioRefs.current.set(pid, el)
            if ((el as any).srcObject !== stream) (el as any).srcObject = stream
            try {
              el.play()
            } catch {
            }
          }}
        />
      ))}
      <button
        type="button"
        onClick={() => (voice.toggleMic ? voice.toggleMic() : voice.setMicEnabled(v => !v))}
        className={buttonClass}
        disabled={voice.micPermission === 'denied'}
        title={getTitle()}
      >
        {getLabel()}
      </button>
      {Object.keys(voice.remoteStreams).length > 0 && !audioUnlocked ? (
        <button
          type="button"
          onClick={async () => {
            let ok = false
            for (const el of audioRefs.current.values()) {
              try {
                el.muted = false
                el.volume = 1
                await el.play()
                ok = true
              } catch {
              }
            }
            if (ok) setAudioUnlocked(true)
          }}
          className={[
            'rounded-full text-sm font-bold px-4 py-2 border',
            variant === 'light'
              ? 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
              : 'bg-white/10 hover:bg-white/15 border-white/20 text-white',
          ].join(' ')}
          title="部分设备需要点击一次以允许播放语音"
        >
          🔊 启用声音
        </button>
      ) : null}
      {speakingText ? (
        <div className={['hidden md:block text-[12px] font-semibold', variant === 'light' ? 'text-slate-700' : 'text-white/80'].join(' ')}>
          {speakingText}
        </div>
      ) : null}
    </div>
  )
}
