import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { socket } from '../services/socket'

type RemoteStreams = Record<string, MediaStream>
type SpeakingLevels = Record<string, number>

type WebRtcSignal = {
  toPlayerId?: string
  fromPlayerId?: string
  description?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

function clamp01(v: number) {
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

function computeRms(data: Uint8Array) {
  let sum = 0
  for (let i = 0; i < data.length; i += 1) {
    const x = (data[i] - 128) / 128
    sum += x * x
  }
  return Math.sqrt(sum / data.length)
}

export function useRoomVoice(params: { roomId: string; playerId: string; peerIds: string[] }) {
  const { roomId, playerId, peerIds } = params
  const [micEnabled, setMicEnabled] = useState(false)
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreams>({})
  const [speakingLevels, setSpeakingLevels] = useState<SpeakingLevels>({})
  const [micPermission, setMicPermission] = useState<'idle' | 'granted' | 'denied'>('idle')
  const micEnabledRef = useRef(false)
  const webrtcSupported = useMemo(() => {
    if (typeof window === 'undefined') return false
    return typeof (window as any).RTCPeerConnection !== 'undefined'
  }, [])

  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const offeredRef = useRef<Set<string>>(new Set())
  const iceRestartedRef = useRef<Map<string, number>>(new Map())
  const disconnectTimerRef = useRef<Map<string, number>>(new Map())
  const localStreamRef = useRef<MediaStream | null>(null)
  const localAudioTrackRef = useRef<MediaStreamTrack | null>(null)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyzersRef = useRef<
    Map<
      string,
      { analyser: AnalyserNode; source: MediaStreamAudioSourceNode; data: Uint8Array; last: number }
    >
  >(new Map())
  const volumeTimerRef = useRef<number | null>(null)

  const rtcConfig = useMemo(
    () => ({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    }),
    [],
  )

  const canCaptureMic = useMemo(() => {
    if (typeof window === 'undefined') return false
    const host = window.location?.hostname || ''
    const isLocalhost = host === 'localhost' || host === '127.0.0.1'
    return !!window.isSecureContext || isLocalhost
  }, [])

  const ensureAudioContextResumed = useCallback(async () => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    if (ctx.state !== 'suspended') return
    try {
      await ctx.resume()
    } catch {
    }
  }, [])

  const attachLocalTrackToPc = useCallback((pc: RTCPeerConnection) => {
    const stream = localStreamRef.current
    const track = localAudioTrackRef.current
    const senders = pc.getSenders()
    const sender = senders.find(s => s.track?.kind === 'audio') || null
    if (sender) {
      try {
        sender.replaceTrack(track || null)
      } catch {
      }
      return
    }

    const transceivers = pc.getTransceivers()
    let audioTransceiver =
      transceivers.find(t => t.sender?.track?.kind === 'audio') ||
      transceivers.find(t => t.receiver?.track?.kind === 'audio') ||
      null

    if (!audioTransceiver) {
      try {
        audioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' })
      } catch {
        audioTransceiver = null
      }
    } else {
      try {
        audioTransceiver.direction = 'sendrecv'
      } catch {
      }
    }

    if (audioTransceiver) {
      try {
        audioTransceiver.sender.replaceTrack(track || null)
      } catch {
      }
      return
    }

    if (stream && track) {
      try {
        pc.addTrack(track, stream)
      } catch {
      }
    }
  }, [])

  const ensureLocalMicStream = useCallback(async () => {
    if (!roomId || !playerId) return
    if (!webrtcSupported) return
    if (!canCaptureMic) {
      setMicPermission('denied')
      return
    }
    if (localAudioTrackRef.current) {
      setMicPermission('granted')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream
      const track = stream.getAudioTracks()[0] || null
      localAudioTrackRef.current = track
      if (track) track.enabled = micEnabledRef.current
      setMicPermission('granted')
      pcsRef.current.forEach(pc => attachLocalTrackToPc(pc))
    } catch {
      setMicPermission('denied')
    }
  }, [attachLocalTrackToPc, canCaptureMic, playerId, roomId, webrtcSupported])

  const stopVolumeLoopIfIdle = useCallback(() => {
    if (analyzersRef.current.size > 0) return
    if (volumeTimerRef.current !== null) {
      window.clearInterval(volumeTimerRef.current)
      volumeTimerRef.current = null
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close()
      } catch {
      }
      audioCtxRef.current = null
    }
  }, [])

  const ensureVolumeLoop = useCallback(() => {
    if (volumeTimerRef.current !== null) return
    volumeTimerRef.current = window.setInterval(() => {
      const next: SpeakingLevels = {}
      analyzersRef.current.forEach((v, pid) => {
        v.analyser.getByteTimeDomainData(v.data)
        const rms = computeRms(v.data)
        const level = clamp01((rms - 0.02) / 0.18)
        v.last = level
        next[pid] = level
      })
      setSpeakingLevels(next)
    }, 120)
  }, [])

  const cleanupPeer = useCallback(
    (peerIdToCleanup: string) => {
      const disconnectTimer = disconnectTimerRef.current.get(peerIdToCleanup)
      if (typeof disconnectTimer === 'number') {
        try {
          window.clearTimeout(disconnectTimer)
        } catch {
        }
        disconnectTimerRef.current.delete(peerIdToCleanup)
      }
      const pc = pcsRef.current.get(peerIdToCleanup)
      if (pc) {
        try {
          pc.onicecandidate = null
          pc.ontrack = null
          pc.onconnectionstatechange = null
          pc.close()
        } catch {
        }
        pcsRef.current.delete(peerIdToCleanup)
      }
      offeredRef.current.delete(peerIdToCleanup)
      iceRestartedRef.current.delete(peerIdToCleanup)
      setRemoteStreams(prev => {
        if (!prev[peerIdToCleanup]) return prev
        const next = { ...prev }
        delete next[peerIdToCleanup]
        return next
      })
      const analyser = analyzersRef.current.get(peerIdToCleanup)
      if (analyser) {
        try {
          analyser.source.disconnect()
          analyser.analyser.disconnect()
        } catch {
        }
        analyzersRef.current.delete(peerIdToCleanup)
        stopVolumeLoopIfIdle()
      }
      setSpeakingLevels(prev => {
        if (!prev[peerIdToCleanup]) return prev
        const next = { ...prev }
        delete next[peerIdToCleanup]
        return next
      })
    },
    [stopVolumeLoopIfIdle],
  )

  const ensurePeerConnection = useCallback(
    (peerIdToEnsure: string) => {
      if (!webrtcSupported) return null
      const existing = pcsRef.current.get(peerIdToEnsure)
      if (existing) return existing

      const pc = new RTCPeerConnection(rtcConfig)

      const restartIce = async () => {
        const tried = iceRestartedRef.current.get(peerIdToEnsure) || 0
        if (tried >= 1) {
          cleanupPeer(peerIdToEnsure)
          return
        }
        iceRestartedRef.current.set(peerIdToEnsure, tried + 1)
        try {
          pc.restartIce()
        } catch {
        }
        try {
          attachLocalTrackToPc(pc)
          const offer = await pc.createOffer({ iceRestart: true } as any)
          await pc.setLocalDescription(offer)
          socket.emit('webrtc_signal', { toPlayerId: peerIdToEnsure, description: pc.localDescription })
          offeredRef.current.add(peerIdToEnsure)
        } catch {
          cleanupPeer(peerIdToEnsure)
        }
      }

      pc.onicecandidate = ev => {
        if (!ev.candidate) return
        socket.emit('webrtc_signal', { toPlayerId: peerIdToEnsure, candidate: ev.candidate.toJSON() })
      }

      pc.ontrack = ev => {
        const stream = ev.streams?.[0] || new MediaStream(ev.track ? [ev.track] : [])
        if (stream.getTracks().length === 0) return
        setRemoteStreams(prev => {
          if (prev[peerIdToEnsure] === stream) return prev
          return { ...prev, [peerIdToEnsure]: stream }
        })

        if (!audioCtxRef.current) {
          try {
            audioCtxRef.current = new AudioContext()
          } catch {
            audioCtxRef.current = null
          }
        }
        const ctx = audioCtxRef.current
        if (ctx) {
          ensureAudioContextResumed()
          try {
            const source = ctx.createMediaStreamSource(stream)
            const analyser = ctx.createAnalyser()
            analyser.fftSize = 512
            source.connect(analyser)
            analyzersRef.current.set(peerIdToEnsure, {
              source,
              analyser,
              data: new Uint8Array(analyser.fftSize),
              last: 0,
            })
            ensureVolumeLoop()
          } catch {
          }
        }
      }

      pc.onconnectionstatechange = () => {
        const s = pc.connectionState
        if (s === 'failed') {
          restartIce()
          return
        }
        if (s === 'disconnected') {
          const existingTimer = disconnectTimerRef.current.get(peerIdToEnsure)
          if (typeof existingTimer === 'number') return
          const t = window.setTimeout(() => {
            disconnectTimerRef.current.delete(peerIdToEnsure)
            if (pc.connectionState === 'disconnected') restartIce()
          }, 4000)
          disconnectTimerRef.current.set(peerIdToEnsure, t)
          return
        }
        if (s === 'connected') {
          const disconnectTimer = disconnectTimerRef.current.get(peerIdToEnsure)
          if (typeof disconnectTimer === 'number') {
            try {
              window.clearTimeout(disconnectTimer)
            } catch {
            }
            disconnectTimerRef.current.delete(peerIdToEnsure)
          }
          iceRestartedRef.current.set(peerIdToEnsure, 0)
        }
        if (s === 'closed') cleanupPeer(peerIdToEnsure)
      }

      try {
        pc.addTransceiver('audio', { direction: 'sendrecv' })
      } catch {
      }
      attachLocalTrackToPc(pc)

      pcsRef.current.set(peerIdToEnsure, pc)
      return pc
    },
    [attachLocalTrackToPc, cleanupPeer, ensureAudioContextResumed, ensureVolumeLoop, rtcConfig, webrtcSupported],
  )

  const createOfferTo = useCallback(
    async (peerIdToOffer: string) => {
      const pc = ensurePeerConnection(peerIdToOffer)
      if (!pc) return
      attachLocalTrackToPc(pc)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit('webrtc_signal', { toPlayerId: peerIdToOffer, description: pc.localDescription })
      offeredRef.current.add(peerIdToOffer)
    },
    [attachLocalTrackToPc, ensurePeerConnection],
  )

  const ensureHandshakeWith = useCallback(
    async (peerIdToHandshake: string, forceOffer: boolean) => {
      if (!webrtcSupported) return
      if (!peerIdToHandshake || peerIdToHandshake === playerId) return
      const shouldOffer = playerId.localeCompare(peerIdToHandshake) < 0
      ensurePeerConnection(peerIdToHandshake)
      if (shouldOffer) {
        if (forceOffer || !offeredRef.current.has(peerIdToHandshake)) {
          try {
            await createOfferTo(peerIdToHandshake)
          } catch {
          }
        }
      }
    },
    [createOfferTo, ensurePeerConnection, playerId, webrtcSupported],
  )

  useEffect(() => {
    if (!roomId || !playerId) return
    if (!webrtcSupported) {
      setMicPermission('denied')
      return
    }
    if (!canCaptureMic) {
      setMicPermission('denied')
      return
    }
    setMicPermission(prev => (prev === 'denied' ? prev : 'idle'))
  }, [canCaptureMic, playerId, roomId, webrtcSupported])

  useEffect(() => {
    micEnabledRef.current = micEnabled
    const track = localAudioTrackRef.current
    if (track) track.enabled = micEnabled
    if (micEnabled) {
      ensureAudioContextResumed()
      ensureLocalMicStream()
    }
  }, [ensureAudioContextResumed, ensureLocalMicStream, micEnabled])

  useEffect(() => {
    if (!roomId || !playerId) return

    socket.joinRoom(roomId, playerId)

    const onVoiceJoin = (payload: any) => {
      const from = payload?.fromPlayerId
      if (typeof from !== 'string' || !from || from === playerId) return
      ensureHandshakeWith(from, true)
    }

    const onVoiceLeave = (payload: any) => {
      const from = payload?.fromPlayerId
      if (typeof from !== 'string' || !from || from === playerId) return
      cleanupPeer(from)
    }

    const onSignal = async (payload: WebRtcSignal) => {
      if (!webrtcSupported) return
      if (payload?.toPlayerId && payload.toPlayerId !== playerId) return
      const from = payload?.fromPlayerId
      if (typeof from !== 'string' || !from || from === playerId) return

      const pc = ensurePeerConnection(from)
      if (!pc) return
      attachLocalTrackToPc(pc)

      try {
        if (payload.description) {
          const desc = payload.description
          if (desc.type === 'offer') {
            await pc.setRemoteDescription(desc)
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            socket.emit('webrtc_signal', { toPlayerId: from, description: pc.localDescription })
            offeredRef.current.add(from)
          } else if (desc.type === 'answer') {
            await pc.setRemoteDescription(desc)
          }
        }
      } catch {
      }

      try {
        if (payload.candidate) {
          await pc.addIceCandidate(payload.candidate)
        }
      } catch {
      }
    }

    socket.on('voice_join', onVoiceJoin)
    socket.on('voice_leave', onVoiceLeave)
    socket.on('webrtc_signal', onSignal)
    socket.emit('voice_join', { roomId, playerId })

    return () => {
      socket.emit('voice_leave', { roomId, playerId })
      socket.off('voice_join', onVoiceJoin)
      socket.off('voice_leave', onVoiceLeave)
      socket.off('webrtc_signal', onSignal)
      Array.from(pcsRef.current.keys()).forEach(pid => cleanupPeer(pid))
      const stream = localStreamRef.current
      localStreamRef.current = null
      localAudioTrackRef.current = null
      if (stream) {
        try {
          stream.getTracks().forEach(t => t.stop())
        } catch {
        }
      }
      analyzersRef.current.clear()
      stopVolumeLoopIfIdle()
    }
  }, [attachLocalTrackToPc, cleanupPeer, ensureHandshakeWith, ensurePeerConnection, playerId, roomId, stopVolumeLoopIfIdle, webrtcSupported])

  useEffect(() => {
    if (!roomId || !playerId) return
    if (!webrtcSupported) return
    peerIds
      .filter(pid => typeof pid === 'string' && pid && pid !== playerId)
      .forEach(pid => {
        ensureHandshakeWith(pid, false)
      })
  }, [ensureHandshakeWith, peerIds, playerId, roomId, webrtcSupported])

  const toggleMic = useCallback(() => {
    ensureAudioContextResumed()
    const next = !micEnabledRef.current
    if (next) ensureLocalMicStream()
    setMicEnabled(next)
  }, [ensureAudioContextResumed, ensureLocalMicStream])

  return {
    micEnabled,
    setMicEnabled,
    toggleMic,
    micPermission,
    remoteStreams,
    speakingLevels,
  }
}
