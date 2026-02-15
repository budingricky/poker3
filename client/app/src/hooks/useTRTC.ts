import { useState, useEffect, useRef, useCallback } from 'react';
import TRTC from 'trtc-js-sdk';
import { api } from '../services/api';

export function useTRTC(roomId: string, playerId: string) {
  const [micEnabled, setMicEnabled] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, any>>({});
  const [speakingLevels, setSpeakingLevels] = useState<Record<string, number>>({});
  const [micPermission, setMicPermission] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<any>(null);
  const localStreamRef = useRef<any>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const leave = useCallback(async () => {
    if (localStreamRef.current) {
      localStreamRef.current.close();
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
  }, []);

  const init = useCallback(async () => {
    if (!roomId || !playerId) return;

    try {
      const sigRes = await api.getTRTCSig(playerId);
      if (!sigRes.success) {
        // Silent fail or log?
        console.warn('TRTC Sig failed:', sigRes.error);
        return;
      }
      const { userSig, sdkAppId } = sigRes.data;

      // Hash roomId to integer to ensure compatibility
      let finalRoomId: number;
      const parsed = parseInt(roomId);
      if (!isNaN(parsed) && parsed.toString() === roomId && parsed < 4294967295) {
          finalRoomId = parsed;
      } else {
          // Simple hash
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
            levels[item.userId] = item.audioVolume / 100; // 0-100 -> 0-1
        });
        setSpeakingLevels(levels);
      });
      
      client.enableAudioVolumeEvaluation(200);

      await client.join({ roomId: finalRoomId });

    } catch (e: any) {
      console.error('TRTC Init failed', e);
      if (mountedRef.current) {
        setError(e.message);
        setMicPermission('denied');
      }
    }
  }, [roomId, playerId]);

  useEffect(() => {
    init();
    return () => {
      leave();
    };
  }, [init, leave]);

  const toggleMic = useCallback(async () => {
    if (!clientRef.current) return;
    
    if (micEnabled) {
        // Turn off
        if (localStreamRef.current) {
            localStreamRef.current.close();
            localStreamRef.current = null;
            try {
                await clientRef.current.unpublish();
            } catch(e) {}
        }
        setMicEnabled(false);
    } else {
        // Turn on
        try {
            const localStream = TRTC.createStream({ userId: playerId, audio: true, video: false });
            await localStream.initialize();
            localStreamRef.current = localStream;
            await clientRef.current.publish(localStream);
            setMicEnabled(true);
            setMicPermission('granted');
        } catch (e: any) {
            console.error('Mic failed', e);
            setMicPermission('denied');
            alert('无法访问麦克风: ' + e.message);
        }
    }
  }, [micEnabled, playerId]);

  return {
    micEnabled,
    toggleMic,
    micPermission,
    remoteStreams,
    speakingLevels,
    error
  };
}
