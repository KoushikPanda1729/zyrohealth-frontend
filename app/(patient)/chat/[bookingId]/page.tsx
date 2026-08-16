'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button, Input, Spin, Typography, Avatar } from 'antd';
import { SendOutlined, UserOutlined, ArrowLeftOutlined, VideoCameraOutlined, PaperClipOutlined, FilePdfOutlined, CloseOutlined } from '@ant-design/icons';
import { useParams, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { api, apiCall } from '../../../../lib/api';
import { getUser } from '../../../../lib/auth';

const { Text } = Typography;

interface Message {
  id: string;
  senderId: string;
  content: string;
  sentAt: string;
  type: string;
  fileUrl?: string;
  isRead?: boolean;
  sender?: { fullName?: string };
}

interface BookingInfo {
  id: string;
  scheduledAt: string;
  consultationType?: string;
  doctor?: { fullName?: string };
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 14px', background: '#fff', borderRadius: '18px 18px 18px 4px', width: 56, boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#94a3b8', animation: 'typingBounce 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
      ))}
      <style>{`@keyframes typingBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}`}</style>
    </div>
  );
}

function ReadTicks({ isRead, isMine }: { isRead: boolean; isMine: boolean }) {
  if (!isMine) return null;
  return (
    <span style={{ marginLeft: 4, display: 'inline-flex', alignItems: 'center' }}>
      <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
        <path d="M1 5L4.5 8.5L10 2" stroke={isRead ? '#60d0ff' : 'rgba(255,255,255,0.5)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5 5L8.5 8.5L14 2" stroke={isRead ? '#60d0ff' : 'rgba(255,255,255,0.5)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  );
}

function MsgContent({ msg, isMe }: { msg: Message; isMe: boolean }) {
  if (msg.fileUrl && msg.type === 'image') {
    return (
      <div>
        <img src={msg.fileUrl} alt={msg.content} style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 10, cursor: 'pointer', display: 'block' }} onClick={() => window.open(msg.fileUrl, '_blank')} />
        {msg.content && <div style={{ fontSize: 11, marginTop: 4, opacity: 0.65 }}>{msg.content}</div>}
      </div>
    );
  }
  if (msg.fileUrl && (msg.type === 'file' || msg.type === 'prescription')) {
    return (
      <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, color: isMe ? '#fff' : '#0e7490', textDecoration: 'none' }}>
        <FilePdfOutlined style={{ fontSize: 22, flexShrink: 0 }} />
        <span style={{ fontSize: 13, textDecoration: 'underline', wordBreak: 'break-all' }}>{msg.content}</span>
      </a>
    );
  }
  return <div>{msg.content}</div>;
}

export default function PatientChatPage() {
  const { bookingId } = useParams() as { bookingId: string };
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [othersRead, setOthersRead] = useState(false);
  const [doctorOnline, setDoctorOnline] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollBottom = useCallback(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, []);

  const clearPendingFile = useCallback(() => {
    setPendingFile(null);
    if (pendingPreview) { URL.revokeObjectURL(pendingPreview); setPendingPreview(null); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [pendingPreview]);

  useEffect(() => {
    const init = async () => {
      try {
        const [msgRes, bRes] = await Promise.all([
          apiCall('GET', `/api/chat/${bookingId}/messages?page=1&limit=100`),
          apiCall('GET', `/api/bookings/${bookingId}`),
        ]);
        const msgs: Message[] = msgRes.data ?? msgRes ?? [];
        setMessages(msgs);
        setBooking(bRes.data ?? bRes);
        const user = getUser() as { id?: string } | null;
        if (user?.id) {
          setMyId(user.id);
          const lastMine = [...msgs].reverse().find((m) => m.senderId === user.id);
          if (lastMine?.isRead) setOthersRead(true);
        }
      } finally { setLoading(false); }
    };
    void init();
  }, [bookingId]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    const user = getUser() as { id?: string } | null;
    if (user?.id) setMyId(user.id);
    const socket = io(process.env.NEXT_PUBLIC_API_URL ?? '', { auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('connect', () => { socket.emit('join_room', { bookingId }); socket.emit('read_receipt', { bookingId }); });
    socket.on('user_joined', () => setDoctorOnline(true));
    socket.on('user_left', () => setDoctorOnline(false));
    socket.on('user_offline', () => setDoctorOnline(false));
    socket.on('new_message', (msg: Message) => { setMessages((p) => [...p, msg]); setTimeout(scrollBottom, 50); socket.emit('read_receipt', { bookingId }); });
    socket.on('typing', ({ userId }: { userId: string }) => {
      if (userId !== myId) { setTyping(true); if (typingTimer.current) clearTimeout(typingTimer.current); typingTimer.current = setTimeout(() => setTyping(false), 2500); }
    });
    socket.on('read_receipt', ({ userId }: { userId: string }) => { if (userId !== myId) setOthersRead(true); });
    return () => { socket.emit('leave_room', { bookingId }); socket.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  useEffect(() => { scrollBottom(); }, [messages, scrollBottom]);

  const handleSend = useCallback(async () => {
    const hasText = input.trim().length > 0;
    if (!hasText && !pendingFile) return;

    if (pendingFile) {
      setUploading(true);
      try {
        const form = new FormData();
        form.append('file', pendingFile);
        const res = await api.post(`/api/chat/${bookingId}/upload`, form);
        const { url } = res.data.data ?? res.data;
        const isImage = pendingFile.type.startsWith('image/');
        setOthersRead(false);
        socketRef.current?.emit('send_message', { bookingId, type: isImage ? 'image' : 'file', content: pendingFile.name, fileUrl: url });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[Upload]', err);
      } finally {
        setUploading(false);
        clearPendingFile();
      }
    }

    if (hasText) {
      setOthersRead(false);
      socketRef.current?.emit('send_message', { bookingId, type: 'text', content: input.trim() });
      setInput('');
    }
  }, [input, pendingFile, bookingId, clearPendingFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    if (file.type.startsWith('image/')) {
      setPendingPreview(URL.createObjectURL(file));
    } else {
      setPendingPreview(null);
    }
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const imageItem = Array.from(e.clipboardData.items).find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    e.preventDefault();
    const blob = imageItem.getAsFile();
    if (!blob) return;
    const ext = imageItem.type.split('/')[1] ?? 'png';
    const file = new File([blob], `paste-${Date.now()}.${ext}`, { type: imageItem.type });
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
  }, [pendingPreview]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); }
  };

  const handleInput = (val: string) => {
    setInput(val);
    socketRef.current?.emit('typing', { bookingId });
  };

  const rawDoctorName = booking?.doctor?.fullName || 'Doctor';
  const doctorName = rawDoctorName.toLowerCase().startsWith('dr.') ? rawDoctorName : `Dr. ${rawDoctorName}`;
  const canSend = input.trim().length > 0 || !!pendingFile;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', maxWidth: 760, margin: '0 auto', background: '#f7f8fc', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => router.back()} style={{ color: '#64748b' }} />
        <div style={{ position: 'relative' }}>
          <Avatar size={42} icon={<UserOutlined />} style={{ background: '#0e7490' }} />
          {doctorOnline && <div style={{ position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, background: '#22c55e', border: '2px solid #fff', borderRadius: '50%' }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text strong style={{ fontSize: 15, display: 'block', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doctorName}</Text>
          <Text style={{ fontSize: 12, color: doctorOnline ? '#22c55e' : '#94a3b8', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {typing ? '✏️ typing…' : doctorOnline ? 'Online' : booking?.scheduledAt ? new Date(booking.scheduledAt).toLocaleString() : 'Offline'}
          </Text>
        </div>
        {booking?.consultationType === 'video' && (
          <Button type="primary" icon={<VideoCameraOutlined />} onClick={() => router.push(`/call/${bookingId}`)} style={{ background: '#0e7490', border: 'none', borderRadius: 20, flexShrink: 0 }}>Join Call</Button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 4, background: 'linear-gradient(180deg, #f0f4fa 0%, #f7f8fc 100%)' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: 60, fontSize: 14 }}>No messages yet. Start the conversation!</div>
        ) : messages.map((msg, idx) => {
          const isMe = msg.senderId === myId;
          const showSender = !isMe && (idx === 0 || messages[idx - 1].senderId !== msg.senderId);
          const isLast = isMe && idx === messages.length - 1;
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 2 }}>
              <div style={{ maxWidth: '68%' }}>
                {showSender && !isMe && <Text style={{ fontSize: 11, color: '#94a3b8', marginLeft: 12, marginBottom: 2, display: 'block' }}>{msg.sender?.fullName ?? doctorName}</Text>}
                <div style={{ background: isMe ? 'linear-gradient(135deg, #0e7490 0%, #0891b2 100%)' : '#fff', color: isMe ? '#fff' : '#1e293b', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: msg.type === 'image' && msg.fileUrl ? '6px' : '10px 14px', fontSize: 14, lineHeight: 1.5, boxShadow: isMe ? '0 2px 8px rgba(14,116,144,0.25)' : '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <MsgContent msg={msg} isMe={isMe} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2, marginTop: 3, padding: msg.type === 'image' && msg.fileUrl ? '0 6px 4px' : '0' }}>
                    <Text style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,0.65)' : '#94a3b8' }}>{new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    {isMe && <ReadTicks isRead={isLast ? othersRead : (msg.isRead ?? false)} isMine />}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {typing && <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4 }}><TypingDots /></div>}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{ background: '#fff', borderTop: '1px solid #f1f5f9' }}>
        {/* Pending file preview */}
        {pendingFile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
            {pendingPreview ? (
              <img src={pendingPreview} alt="preview" style={{ height: 60, width: 60, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fef2f2', borderRadius: 8, padding: '8px 12px' }}>
                <FilePdfOutlined style={{ color: '#ef4444', fontSize: 20 }} />
                <Text style={{ fontSize: 12, color: '#475569', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pendingFile.name}</Text>
              </div>
            )}
            <Button size="small" type="text" icon={<CloseOutlined />} onClick={clearPendingFile} style={{ marginLeft: 'auto', color: '#94a3b8' }} />
          </div>
        )}
        {/* Input row */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px', alignItems: 'flex-end' }}>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style={{ display: 'none' }} onChange={handleFileSelect} />
          <Button icon={<PaperClipOutlined />} onClick={() => fileInputRef.current?.click()} style={{ borderRadius: '50%', width: 44, height: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#f1f5f9', border: 'none', color: '#64748b' }} />
          <Input.TextArea
            value={input}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Type a message…"
            autoSize={{ minRows: 1, maxRows: 5 }}
            style={{ borderRadius: 22, resize: 'none', fontSize: 14, padding: '8px 16px', border: '1.5px solid #e2e8f0', background: '#f8fafc' }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={() => void handleSend()}
            disabled={!canSend}
            loading={uploading}
            style={{ borderRadius: '50%', width: 44, height: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: canSend ? '#0e7490' : '#e2e8f0', border: 'none', transition: 'background 0.2s' }}
          />
        </div>
      </div>
    </div>
  );
}
