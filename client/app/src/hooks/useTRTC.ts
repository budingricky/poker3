import { useState, useEffect, useRef, useCallback } from 'react';
import TRTC from 'trtc-js-sdk';
import { api } from '../services/api';

export function useTRTC(roomId: string, playerId: string) {
  const [micEnabled, setMicEnabled] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, any>>({});
  const [speakingLevels, setSpeakingLevels] = useState<Record<string, number>>({});
  const [micPermission, setMicPermission] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [status, setStatus] = useState<'idle' | 'initializing' | 'joined' | 'error'>('idle');

  const clientRef = useRef<any>(null);
  const localStreamRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const statusRef = useRef(status);
  const joinedRef = useRef(isJoined);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    joinedRef.current = isJoined;
  }, [isJoined]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const leave = useCallback(async () => {
    if (localStreamRef.current) {
      const streamToUnpublish = localStreamRef.current;
      if (clientRef.current) {
        try {
          await clientRef.current.unpublish(streamToUnpublish);
        } catch(e) {}
      }
      streamToUnpublish.close();
      localStreamRef.current = null;
    }
    if (clientRef.current) {
      try {
        await clientRef.current.leave();
      } catch (e) {}
      clientRef.current = null;
    }
    setRemoteStreams({});
    setSpeakingLevels({});
    setMicEnabled(false);
    setIsJoined(false);
    setStatus('idle');
    setError(null);
  }, []);

  const init = useCallback(async (force?: boolean) => {
    if (!roomId || !playerId) return;

    if (!force && (statusRef.current === 'initializing' || statusRef.current === 'joined')) return;
    if (initPromiseRef.current) return initPromiseRef.current;

    const p = (async () => {
      if (mountedRef.current) {
        setStatus('initializing');
        setError(null);
      }

      if (force && clientRef.current) {
        // 清理现有流
        if (localStreamRef.current) {
          const streamToUnpublish = localStreamRef.current;
          try {
            await clientRef.current.unpublish(streamToUnpublish);
          } catch(e) {}
          streamToUnpublish.close();
          localStreamRef.current = null;
        }
        try {
          await clientRef.current.leave();
        } catch (e) {}
        clientRef.current = null;
        if (mountedRef.current) setIsJoined(false);
      }

      const sigRes = await api.getTRTCSig(playerId);
      if (!sigRes.success) {
        const msg = '获取语音签名失败: ' + (sigRes.error || '未知错误');
        if (mountedRef.current) {
          setError(msg);
          setStatus('error');
        }
        return;
      }
      const { userSig, sdkAppId } = sigRes.data;

      let finalRoomId: number;
      const parsed = parseInt(roomId);
      if (!isNaN(parsed) && parsed.toString() === roomId && parsed < 4294967295) {
          finalRoomId = parsed;
      } else {
          let hash = 0;
          for (let i = 0; i < roomId.length; i++) {
            hash = ((hash << 5) - hash) + roomId.charCodeAt(i);
            hash |= 0;
          }
          finalRoomId = Math.abs(hash) % 4294967295;
      }

      const client = TRTC.createClient({
        mode: 'rtc',
        sdkAppId,
        userId: playerId,
        userSig,
      });
      clientRef.current = client;

      client.on('stream-added', (event: any) => {
        const remoteStream = event.stream;
        client.subscribe(remoteStream);
      });

      client.on('stream-subscribed', (event: any) => {
        const remoteStream = event.stream;
        const remoteUserId = remoteStream.getUserId();
        setRemoteStreams(prev => ({ ...prev, [remoteUserId]: remoteStream }));
      });

      client.on('stream-removed', (event: any) => {
        const remoteStream = event.stream;
        const remoteUserId = remoteStream.getUserId();
        remoteStream.stop();
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[remoteUserId];
          return next;
        });
      });
      
      client.on('audio-volume', (event: any) => {
        const levels: Record<string, number> = {};
        event.result.forEach((item: any) => {
            levels[item.userId] = item.audioVolume / 100;
        });
        setSpeakingLevels(levels);
      });
      
      client.enableAudioVolumeEvaluation(200);

      if (joinedRef.current) return;
      
      // 加入房间，最多重试3次
      let joinError: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await client.join({ roomId: finalRoomId });
          joinError = null;
          break;
        } catch (e) {
          joinError = e;
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
          }
        }
      }
      
      if (joinError) {
        throw joinError;
      }
      
      if (mountedRef.current) {
        setIsJoined(true);
        setStatus('joined');
        setError(null);
      }
    })()
      .catch((e: any) => {
        if (mountedRef.current) {
          setError(e?.message || '语音连接失败');
          setStatus('error');
          if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
            setMicPermission('denied');
          }
        }
      })
      .finally(() => {
        initPromiseRef.current = null;
      });

    initPromiseRef.current = p;
    return p;
  }, [roomId, playerId]);

  useEffect(() => {
    init();
    return () => {
      leave();
    };
  }, [init, leave]);

  useEffect(() => {
    const eventName = micEnabled ? 'trtc-mic-enabled' : 'trtc-mic-disabled';
    window.dispatchEvent(new CustomEvent(eventName));
  }, [micEnabled]);

  const toggleMic = useCallback(async () => {
    if (!clientRef.current || !isJoined) {
      if (statusRef.current === 'initializing') return;
      if (statusRef.current === 'error') {
        await init(true);
      } else {
        await init();
      }
      return;
    }

    if (micEnabled) {
        if (localStreamRef.current) {
            const streamToUnpublish = localStreamRef.current;
            try {
                await clientRef.current.unpublish(streamToUnpublish);
            } catch(e) {}
            streamToUnpublish.close();
            localStreamRef.current = null;
        }
        setMicEnabled(false);
    } else {
        try {
            // 确保任何现有流都已清理
            if (localStreamRef.current) {
                const streamToUnpublish = localStreamRef.current;
                try {
                    await clientRef.current.unpublish(streamToUnpublish);
                } catch(e) {}
                streamToUnpublish.close();
                localStreamRef.current = null;
            }
            
            const hasGum = !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function')
            if (!hasGum) {
                setMicPermission('denied')
                setMicEnabled(false)
                setError('当前环境不支持麦克风访问')
                return
            }
            const localStream = TRTC.createStream({ userId: playerId, audio: true, video: false });
            await localStream.initialize();
            localStreamRef.current = localStream;
            await clientRef.current.publish(localStream);
            setMicEnabled(true);
            setMicPermission('granted');
        } catch (e: any) {
            console.error('Mic failed', e);
            if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                 setMicPermission('denied');
            } else {
                 setMicEnabled(false);
                 const msg = String(e?.message || '')
                 if (msg.includes('getTracks')) {
                   setMicPermission('denied')
                   setError('无法访问麦克风（当前 iOS/Android WebView 可能不支持该语音模式）')
                 } else {
                   setError(e?.message || '无法访问麦克风')
                 }
            }
            if (localStreamRef.current) {
              try {
                localStreamRef.current.close()
              } catch {}
              localStreamRef.current = null
            }
        }
    }
  }, [init, isJoined, micEnabled, playerId]);

  return {
    micEnabled,
    toggleMic,
    micPermission,
    remoteStreams,
    speakingLevels,
    error,
    status
  };
}
