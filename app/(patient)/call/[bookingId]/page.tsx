'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button, Input, Spin, Typography } from 'antd';
import {
  AudioMutedOutlined, AudioOutlined, CameraOutlined, StopOutlined,
  ArrowLeftOutlined, PhoneOutlined, MessageOutlined, SendOutlined, UserOutlined,
} from '@ant-design/icons';
import { useParams, useRouter } from 'next/navigation';
import {
  Room, RoomEvent, Track, RemoteParticipant,
  LocalVideoTrack, LocalAudioTrack, createLocalTracks,
} from 'livekit-client';
import { io, Socket } from 'socket.io-client';
import { apiCall } from '../../../../lib/api';
import { getUser } from '../../../../lib/auth';

const { Text } = Typography;

interface ChatMsg {
  id: string;
  senderId: string;
  content: string;
  sentAt: string;
  sender?: { fullName?: string };
}

export default function PatientCallPage() {
  const { bookingId } = useParams() as { bookingId: string };
  const router = useRouter();

  const [joining, setJoining] = useState(true);
  const [inCall, setInCall] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [hasCamera, setHasCamera] = useState(true);
  const [remoteCount, setRemoteCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const localVideoTrackRef = useRef<LocalVideoTrack | null>(null);
  const localAudioTrackRef = useRef<LocalAudioTrack | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const remoteAudioEls = useRef<HTMLAudioElement[]>([]);

  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [myId, setMyId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const attachSubscribedTracks = useCallback((participant: RemoteParticipant) => {
    participant.trackPublications.forEach((pub) => {
      if (!pub.track || !pub.isSubscribed) return;
      if (pub.kind === Track.Kind.Video && remoteVideoRef.current) {
        pub.track.attach(remoteVideoRef.current);
      } else if (pub.kind === Track.Kind.Audio) {
        const el = pub.track.attach() as HTMLAudioElement;
        document.body.appendChild(el);
        remoteAudioEls.current.push(el);
      }
    });
  }, []);

  const clearRemoteVideo = useCallback(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    remoteAudioEls.current.forEach((el) => { el.pause(); el.remove(); });
    remoteAudioEls.current = [];
  }, []);

  const stopLocalTracks = useCallback(() => {
    const srcObj = localVideoRef.current?.srcObject as MediaStream | null;
    srcObj?.getTracks().forEach((t) => t.stop());
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    localVideoTrackRef.current?.mediaStreamTrack?.stop();
    localVideoTrackRef.current?.stop();
    localAudioTrackRef.current?.mediaStreamTrack?.stop();
    localAudioTrackRef.current?.stop();
    clearRemoteVideo();
  }, [clearRemoteVideo]);

  useEffect(() => {
    let mounted = true;

    const start = async () => {
      try {
        const user = getUser() as { id?: string } | null;
        if (user?.id) setMyId(user.id);

        const [msgRes, roomRes] = await Promise.all([
          apiCall('GET', `/api/chat/${bookingId}/messages?page=1&limit=100`),
          apiCall('POST', `/api/bookings/${bookingId}/join-room`),
        ]);
        if (mounted) setMessages(msgRes.data ?? msgRes ?? []);

        const { token, url, roomName } = roomRes.data ?? roomRes;
        console.log('[VideoCall] patient joining room:', roomName);

        let videoTrack: LocalVideoTrack | undefined;
        let audioTrack: LocalAudioTrack | undefined;

        try {
          const tracks = await createLocalTracks({ video: true, audio: true });
          videoTrack = tracks.find((t) => t.kind === Track.Kind.Video) as LocalVideoTrack | undefined;
          audioTrack = tracks.find((t) => t.kind === Track.Kind.Audio) as LocalAudioTrack | undefined;
        } catch {
          try {
            const tracks = await createLocalTracks({ audio: true });
            audioTrack = tracks.find((t) => t.kind === Track.Kind.Audio) as LocalAudioTrack | undefined;
            if (mounted) setHasCamera(false);
          } catch {
            if (mounted) setHasCamera(false);
          }
        }

        if (videoTrack) {
          localVideoTrackRef.current = videoTrack;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = new MediaStream([videoTrack.mediaStreamTrack]);
          }
        }
        if (audioTrack) localAudioTrackRef.current = audioTrack;

        const room = new Room();
        roomRef.current = room;

        // Participant presence → update remoteCount
        room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
          if (!mounted) return;
          setRemoteCount((c) => c + 1);
          attachSubscribedTracks(participant);
        });

        room.on(RoomEvent.ParticipantDisconnected, () => {
          if (!mounted) return;
          setRemoteCount((c) => Math.max(0, c - 1));
          clearRemoteVideo();
        });

        // Track subscription → attach video/audio
        room.on(RoomEvent.TrackSubscribed, (track, _pub, _participant) => {
          if (!mounted) return;
          if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
            track.attach(remoteVideoRef.current);
          } else if (track.kind === Track.Kind.Audio) {
            const el = track.attach() as HTMLAudioElement;
            document.body.appendChild(el);
            remoteAudioEls.current.push(el);
          }
        });

        // On unsubscribe just detach — don't clear srcObject
        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach();
        });

        await room.connect(url, token);

        if (videoTrack) await room.localParticipant.publishTrack(videoTrack);
        if (audioTrack) await room.localParticipant.publishTrack(audioTrack);

        if (mounted) {
          const size = room.remoteParticipants.size;
          setRemoteCount(size);
          if (size > 0) {
            room.remoteParticipants.forEach((p) => attachSubscribedTracks(p));
          }
          setInCall(true);
          setJoining(false);
        }

        const accessToken = localStorage.getItem('accessToken') ?? '';
        const socket = io(process.env.NEXT_PUBLIC_API_URL ?? '', { auth: { token: accessToken }, transports: ['websocket'] });
        socketRef.current = socket;
        socket.on('connect', () => socket.emit('join_room', { bookingId }));
        socket.on('new_message', (msg: ChatMsg) => {
          if (mounted) {
            setMessages((p) => [...p, msg]);
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
          }
        });
      } catch (err) {
        if (mounted) {
          setJoining(false);
          console.error('[VideoCall]', err);
        }
      }
    };

    void start();
    return () => {
      mounted = false;
      stopLocalTracks();
      void roomRef.current?.disconnect();
      socketRef.current?.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  useEffect(() => {
    if (chatOpen) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [chatOpen, messages]);

  // Below this width the chat sidebar would eat most/all of the video area,
  // so it's shown as a full-screen overlay instead of a side-by-side column.
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    const applyMatch = (matches: boolean) => setIsMobile(matches);
    applyMatch(mql.matches);
    const handler = (e: MediaQueryListEvent) => applyMatch(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const sendChat = useCallback(() => {
    const content = chatInput.trim();
    if (!content || !socketRef.current) return;
    socketRef.current.emit('send_message', { bookingId, type: 'text', content });
    setChatInput('');
  }, [chatInput, bookingId]);

  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !micOn;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  };

  const toggleCam = () => {
    const track = localVideoTrackRef.current;
    if (!track) return;
    track.mediaStreamTrack.enabled = !camOn;
    setCamOn((v) => !v);
  };

  const leaveCall = async () => {
    stopLocalTracks();
    await roomRef.current?.disconnect();
    socketRef.current?.emit('leave_room', { bookingId });
    socketRef.current?.disconnect();
    router.back();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0f172a', display: 'flex', flexDirection: 'column', zIndex: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', background: 'rgba(0,0,0,0.5)', flexShrink: 0 }}>
        <Button type="text" icon={<ArrowLeftOutlined style={{ color: '#fff' }} />} onClick={() => router.back()} />
        <Text style={{ color: '#fff', fontWeight: 600, flex: 1 }}>Video Consultation</Text>
        {inCall && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: remoteCount > 0 ? '#22c55e' : '#f59e0b' }} />
            <Text style={{ color: remoteCount > 0 ? '#22c55e' : '#f59e0b', fontSize: 12 }}>
              {remoteCount > 0 ? 'Doctor connected' : 'Waiting for doctor…'}
            </Text>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#1e293b', width: '100%' }}>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: remoteCount > 0 ? 'block' : 'none' }}
          />

          {joining && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <Spin size="large" /><Text style={{ color: '#94a3b8' }}>Joining call…</Text>
            </div>
          )}
          {inCall && remoteCount === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserOutlined style={{ fontSize: 32, color: '#64748b' }} />
              </div>
              <Text style={{ color: '#94a3b8', fontSize: 16 }}>Waiting for doctor to join…</Text>
            </div>
          )}

          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              position: 'absolute', bottom: 16, right: 16,
              width: isMobile ? 100 : 140, height: isMobile ? 72 : 100, borderRadius: 12, objectFit: 'cover',
              border: '2px solid rgba(255,255,255,0.25)',
              background: '#0f172a',
              display: inCall && hasCamera ? 'block' : 'none',
            }}
          />
          {inCall && !hasCamera && (
            <div style={{ position: 'absolute', bottom: 16, right: 16, width: isMobile ? 100 : 140, height: isMobile ? 72 : 100, borderRadius: 12, background: '#1e293b', border: '2px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <StopOutlined style={{ color: '#64748b', fontSize: 18 }} />
            </div>
          )}
        </div>

        {chatOpen && (
          <div style={isMobile
            ? { position: 'absolute', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column', background: '#0f1a2e' }
            : { width: 300, display: 'flex', flexDirection: 'column', background: '#0f1a2e', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <Text style={{ color: '#e2e8f0', fontWeight: 600 }}>In-Call Chat</Text>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {messages.length === 0
                ? <Text style={{ color: '#475569', fontSize: 13, textAlign: 'center', marginTop: 24 }}>No messages yet</Text>
                : messages.map((msg) => {
                  const isMe = msg.senderId === myId;
                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                      <div style={{ maxWidth: '80%', background: isMe ? '#0e7490' : '#1e293b', color: '#fff', borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px', padding: '8px 12px', fontSize: 13 }}>
                        {!isMe && msg.sender?.fullName && <div style={{ fontSize: 10, color: '#34d399', marginBottom: 2, fontWeight: 600 }}>{msg.sender.fullName}</div>}
                        <div>{msg.content}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'right', marginTop: 2 }}>
                          {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              <div ref={bottomRef} />
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onPressEnter={sendChat} placeholder="Message…" style={{ borderRadius: 18, background: '#1e293b', border: 'none', color: '#fff' }} />
              <Button type="primary" icon={<SendOutlined />} onClick={sendChat} disabled={!chatInput.trim()} style={{ borderRadius: '50%', width: 36, height: 36, minWidth: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0e7490', border: 'none' }} />
            </div>
          </div>
        )}
      </div>

      {inCall && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, rowGap: 12, padding: '20px 12px', background: 'rgba(0,0,0,0.65)', flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
          <Ctrl icon={micOn ? <AudioOutlined /> : <AudioMutedOutlined />} label={micOn ? 'Mute' : 'Unmute'} active={!micOn} onClick={() => void toggleMic()} />
          {hasCamera && <Ctrl icon={camOn ? <CameraOutlined /> : <StopOutlined />} label={camOn ? 'Camera off' : 'Camera on'} active={!camOn} onClick={toggleCam} />}
          <Ctrl icon={<MessageOutlined />} label="Chat" active={chatOpen} highlight={chatOpen} onClick={() => setChatOpen((v) => !v)} />
          <div style={{ textAlign: 'center' }}>
            <Button shape="circle" icon={<PhoneOutlined style={{ transform: 'rotate(135deg)', fontSize: 20 }} />}
              style={{ width: 56, height: 56, background: '#ef4444', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => void leaveCall()} />
            <Text style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block' }}>Leave</Text>
          </div>
        </div>
      )}
    </div>
  );
}

function Ctrl({ icon, label, active, highlight, onClick }: { icon: React.ReactNode; label: string; active?: boolean; highlight?: boolean; onClick: () => void }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <Button shape="circle" icon={icon}
        style={{ width: 52, height: 52, background: active ? (highlight ? '#0e7490' : '#ef4444') : 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={onClick} />
      <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 4, display: 'block' }}>{label}</Text>
    </div>
  );
}
