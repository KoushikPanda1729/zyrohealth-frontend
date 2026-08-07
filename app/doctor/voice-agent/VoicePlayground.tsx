'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Room, Track, RoomEvent } from 'livekit-client';
import { apiCall } from '../../../lib/api';

type Msg = { id: string; text: string; role: 'user' | 'agent'; final: boolean };
type Status = 'idle' | 'connecting' | 'connected' | 'disconnecting';

function MicIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="#1677ff">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
    </svg>
  );
}

function EndCallIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="#ff4d4f">
      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C7.61 21 1 14.39 1 6.5c0-.56.45-1 1-1H6c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.24 1.02L6.6 10.8z" />
    </svg>
  );
}

function SpinnerIcon({ color = '#1677ff' }: { color?: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.15" />
      <path d="M12 2a10 10 0 0 1 10 10">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.75s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

export function VoicePlayground({ agentId, open, onClose }: {
  agentId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<Status>('idle');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const audioElemsRef = useRef<HTMLAudioElement[]>([]);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const cleanup = useCallback(() => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    audioElemsRef.current.forEach((el) => { el.srcObject = null; el.remove(); });
    audioElemsRef.current = [];
  }, []);

  useEffect(() => {
    if (!open) {
      cleanup();
      setStatus('idle');
      setMsgs([]);
      setError(null);
      setMuted(false);
    }
  }, [open, cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [msgs]);

  const handleToggle = useCallback(async () => {
    if (status === 'connected' || status === 'connecting') {
      setStatus('disconnecting');
      cleanup();
      setStatus('idle');
      return;
    }
    if (status !== 'idle') return;

    setStatus('connecting');
    setMsgs([]);
    setError(null);

    try {
      const res = await apiCall('GET', `/api/doctor/voice-agents/${agentId}/playground-token`);
      const { token, ws_url } = (res.data ?? res) as { token: string; ws_url: string };

      const room = new Room({
        audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach() as HTMLAudioElement;
          el.autoplay = true;
          document.body.appendChild(el);
          audioElemsRef.current.push(el);
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach();
      });

      room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
        const isAgent = !!participant && participant !== room.localParticipant;
        setMsgs((prev) => {
          const updated = [...prev];
          for (const seg of segments) {
            const idx = updated.findIndex((s) => s.id === seg.id);
            const entry: Msg = {
              id: seg.id,
              text: seg.text,
              role: isAgent ? 'agent' : 'user',
              final: seg.final ?? true,
            };
            if (idx >= 0) updated[idx] = entry;
            else updated.push(entry);
          }
          return updated;
        });
      });

      room.on(RoomEvent.Disconnected, () => {
        audioElemsRef.current.forEach((el) => { el.srcObject = null; el.remove(); });
        audioElemsRef.current = [];
        roomRef.current = null;
        setStatus('idle');
      });

      await room.connect(ws_url, token);
      await room.localParticipant.setMicrophoneEnabled(true);
      setStatus('connected');
    } catch (err) {
      console.error('[Playground] connect error', err);
      cleanup();
      setStatus('idle');
      setError('Failed to connect. Make sure the agent is deployed and try again.');
    }
  }, [agentId, status, cleanup]);

  const handleMute = useCallback(async () => {
    if (!roomRef.current) return;
    const next = !muted;
    await roomRef.current.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  }, [muted]);

  if (!open) return null;

  const isConnected = status === 'connected';
  const isBusy = status === 'connecting' || status === 'disconnecting';
  const visibleMsgs = msgs.filter((m) => m.text.trim());

  return (
    <>
      {/* Overlay to close on click */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 1040, background: 'rgba(0,0,0,0.35)' }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 380,
        background: '#0d1a2e', zIndex: 1050,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-6px 0 40px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 17, letterSpacing: '-0.2px' }}>Test Playground</div>
              <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12, marginTop: 4 }}>
                Test your Voice Agent and see the response in real time
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.38)', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 0 0 12px', flexShrink: 0 }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Transcript */}
        <div
          ref={transcriptRef}
          style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          {visibleMsgs.length === 0 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}>
              <div style={{ color: 'rgba(255,255,255,0.13)', fontSize: 13, textAlign: 'center', lineHeight: 1.6 }}>
                Conversation will appear here
              </div>
            </div>
          )}
          {visibleMsgs.map((m) => (
            <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '82%', padding: '9px 14px', fontSize: 13, lineHeight: 1.55,
                borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: m.role === 'user' ? 'rgba(22,119,255,0.8)' : 'rgba(255,255,255,0.09)',
                color: m.final ? '#fff' : 'rgba(255,255,255,0.55)',
                transition: 'opacity 0.2s',
              }}>
                {m.text}
              </div>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ margin: '0 16px', padding: '10px 14px', background: 'rgba(255,77,79,0.12)', border: '1px solid rgba(255,77,79,0.25)', borderRadius: 8, color: '#ff7875', fontSize: 12 }}>
            {error}
          </div>
        )}

        {/* Controls */}
        <div style={{ padding: '24px 20px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            {/* Mute button — only visible during a call */}
            {isConnected && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div
                  onClick={() => void handleMute()}
                  style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: muted ? 'rgba(255,200,0,0.15)' : 'rgba(255,255,255,0.06)',
                    border: `2px solid ${muted ? '#facc15' : 'rgba(255,255,255,0.15)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
                  {muted ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="#facc15">
                      <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                    </svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                    </svg>
                  )}
                </div>
                <div style={{ color: muted ? '#facc15' : 'rgba(255,255,255,0.35)', fontSize: 11 }}>
                  {muted ? 'Unmute' : 'Mute'}
                </div>
              </div>
            )}

            {/* Glow ring — main call button */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 90, height: 90, borderRadius: '50%',
                background: isConnected ? 'rgba(255,77,79,0.08)' : 'rgba(22,119,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isBusy ? 'none' : isConnected ? '0 0 40px rgba(255,77,79,0.22)' : '0 0 40px rgba(22,119,255,0.2)',
                transition: 'all 0.3s',
              }}>
                <div
                  onClick={!isBusy ? handleToggle : undefined}
                  style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: isConnected ? 'rgba(255,77,79,0.15)' : 'rgba(22,119,255,0.12)',
                    border: `2px solid ${isBusy ? 'rgba(255,255,255,0.15)' : isConnected ? '#ff4d4f' : '#1677ff'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: isBusy ? 'default' : 'pointer',
                    transition: 'all 0.25s',
                  }}
                >
                  {isBusy ? <SpinnerIcon color={isConnected ? '#ff4d4f' : '#1677ff'} /> :
                   isConnected ? <EndCallIcon /> : <MicIcon />}
                </div>
              </div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>
                {status === 'idle' ? 'Start Voice Call' :
                 status === 'connecting' ? 'Connecting...' :
                 status === 'connected' ? 'End Call' : 'Ending...'}
              </div>
            </div>

            {/* Spacer to balance layout when mute is visible */}
            {isConnected && <div style={{ width: 52 }} />}
          </div>

          <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 12, textAlign: 'center', lineHeight: 1.5, minHeight: 32 }}>
            {status === 'idle' ? 'Click the call button to start a voice conversation' :
             status === 'connected' ? (muted ? 'You are muted — tap the mic to speak' : 'Speak to test your voice agent') : ''}
          </div>
        </div>
      </div>
    </>
  );
}
