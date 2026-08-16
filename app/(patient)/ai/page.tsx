'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Input, Button, Typography, Spin, Avatar, Tag, Modal, Dropdown, message, Card,
} from 'antd';
import {
  SendOutlined, RobotOutlined, UserOutlined, PlusOutlined, SearchOutlined,
  EditOutlined, DeleteOutlined, CheckOutlined, CloseOutlined, MoreOutlined,
  MessageOutlined, TeamOutlined, CameraOutlined, CloseCircleOutlined,
  AudioOutlined, SoundOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { apiCall } from '../../../lib/api';

const { Text } = Typography;

interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  imageUrl?: string;
}

interface Session {
  id: string;
  isClosed: boolean;
  title?: string;
  messages: AiMessage[];
  createdAt: string;
  aiDoctorId?: string;
}

interface AiDoctor {
  id: string;
  name: string;
  specialty?: string;
  description?: string;
  avatarUrl?: string;
}

const AVATAR_COLORS = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export default function AiPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [aiDoctors, setAiDoctors] = useState<AiDoctor[]>([]);
  const [activeTab, setActiveTab] = useState('doctors');
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const voiceModeRef = useRef(false);
  const activeSessionRef = useRef<Session | null>(null);
  const startVoiceListeningRef = useRef<() => void>(() => {});

  const loadSession = async (id: string) => {
    try {
      const res = await apiCall('GET', `/api/ai/session/${id}`);
      const s: Session = res.data ?? res;
      return { ...s, messages: s.messages ?? [] };
    } catch { return null; }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const [sessionsRes, doctorsRes] = await Promise.all([
          apiCall('GET', '/api/ai/sessions'),
          apiCall('GET', '/api/ai/doctors'),
        ]);
        const list: Session[] = (sessionsRes.data || sessionsRes || []).map((s: Session) => ({
          ...s, messages: s.messages ?? [],
        }));
        setSessions(list);
        setAiDoctors(doctorsRes.data || doctorsRes || []);
        const open = list.find((s) => !s.isClosed);
        if (open) {
          const full = await loadSession(open.id);
          if (full) { setActiveSession(full); setActiveTab('sessions'); }
        }
      } catch { setSessions([]); }
      finally { setPageLoading(false); }
    };
    init();
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeSession?.messages]);
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus(); renameInputRef.current.select();
    }
  }, [renamingId]);
  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);
  useEffect(() => { activeSessionRef.current = activeSession; }, [activeSession]);
  useEffect(() => () => {
    window.speechSynthesis?.cancel();
    recognitionRef.current?.stop();
  }, []);

  const startNewSession = async (aiDoctorId?: string) => {
    setCreatingId(aiDoctorId ?? 'generic');
    try {
      const res = await apiCall('POST', '/api/ai/session', aiDoctorId ? { aiDoctorId } : {});
      const newSession: Session = { ...(res.data ?? res), messages: [] };
      setSessions((prev) => [newSession, ...prev]);
      setActiveSession(newSession);
      setActiveTab('sessions');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) message.error(err.response?.data?.message || 'Failed to start session');
    } finally { setCreatingId(null); }
  };

  const selectSession = async (s: Session) => {
    if (renamingId || activeSession?.id === s.id) return;
    const full = await loadSession(s.id);
    if (full) setActiveSession(full);
  };

  const sendMessage = async () => {
    if ((!input.trim() && !imageFile) || !activeSession) return;
    const text = input.trim();
    const currentImage = imageFile;
    const currentPreview = imagePreview;
    setInput('');
    setImageFile(null);
    setImagePreview(null);
    setSending(true);

    const optimistic: AiMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text || 'Image sent for analysis.',
      createdAt: new Date().toISOString(),
      imageUrl: currentPreview ?? undefined,
    };
    setActiveSession((prev) => prev ? { ...prev, messages: [...prev.messages, optimistic] } : prev);

    try {
      let res;
      if (currentImage) {
        const formData = new FormData();
        formData.append('message', text || 'Please analyze this image.');
        formData.append('image', currentImage);
        const { api } = await import('../../../lib/api');
        const response = await api.post(`/api/ai/session/${activeSession.id}/message`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        res = response.data;
      } else {
        res = await apiCall('POST', `/api/ai/session/${activeSession.id}/message`, { message: text });
      }
      const serverData = res.data ?? res;
      const serverMessages = [...((serverData.messages ?? []) as AiMessage[])];

      // Keep local data URL for the last user image — S3 URL is private and would show broken
      if (currentPreview && serverMessages.length >= 2) {
        const lastUserIdx = serverMessages.length - 2;
        if (serverMessages[lastUserIdx]?.role === 'user') {
          serverMessages[lastUserIdx] = { ...serverMessages[lastUserIdx], imageUrl: currentPreview };
        }
      }

      const updated: Session = { ...serverData, messages: serverMessages };
      setActiveSession(updated);
      setSessions((prev) => prev.map((s) => s.id === updated.id ? { ...s, title: updated.title, messages: updated.messages } : s));
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) message.error(err.response?.data?.message || 'Failed to send message');
      setActiveSession((prev) => prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== optimistic.id) } : prev);
    } finally {
      setSending(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeImage = () => { setImageFile(null); setImagePreview(null); };

  // ── Voice ────────────────────────────────────────────────────
  const speakAiResponse = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const clean = text
      .replace(/#{1,6}\s/g, '')
      .replace(/[*_`~[\]()]/g, '')
      .replace(/\n+/g, '. ')
      .replace(/⚕️|✓|✗|⚠️/g, '')
      .trim();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.05;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => {
      setSpeaking(false);
      const session = activeSessionRef.current;
      if (voiceModeRef.current && session && !session.isClosed) {
        setTimeout(() => startVoiceListeningRef.current(), 700);
      }
    };
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const sendVoiceMessage = useCallback(async (transcript: string) => {
    const session = activeSessionRef.current;
    if (!session || session.isClosed) return;
    setSending(true);

    const optimistic: AiMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: transcript,
      createdAt: new Date().toISOString(),
    };
    setActiveSession((prev) => prev ? { ...prev, messages: [...prev.messages, optimistic] } : prev);

    try {
      const res = await apiCall('POST', `/api/ai/session/${session.id}/message`, { message: transcript });
      const serverData = res.data ?? res;
      const serverMessages = [...((serverData.messages ?? []) as AiMessage[])];
      const updated: Session = { ...serverData, messages: serverMessages };
      setActiveSession(updated);
      setSessions((prev) => prev.map((s) => s.id === updated.id ? { ...s, title: updated.title, messages: updated.messages } : s));
      const assistantMsgs = serverMessages.filter((m: AiMessage) => m.role === 'assistant');
      const last = assistantMsgs[assistantMsgs.length - 1];
      if (last) speakAiResponse(last.content);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) void message.error(err.response?.data?.message || 'Failed to send');
      setActiveSession((prev) => prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== optimistic.id) } : prev);
      if (voiceModeRef.current) setTimeout(() => startVoiceListeningRef.current(), 1000);
    } finally {
      setSending(false);
    }
  }, [speakAiResponse]);

  const startVoiceListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) { void message.error('Voice not supported. Please use Chrome.'); return; }
    const session = activeSessionRef.current;
    if (!session || session.isClosed) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const transcript = (e.results[0][0].transcript as string).trim();
      if (transcript) void sendVoiceMessage(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  }, [sendVoiceMessage]);

  useEffect(() => {
    startVoiceListeningRef.current = startVoiceListening;
  }, [startVoiceListening]);

  const stopVoiceListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const toggleVoiceMode = useCallback(() => {
    if (voiceModeRef.current) {
      stopSpeaking();
      stopVoiceListening();
      setVoiceMode(false);
    } else {
      setVoiceMode(true);
      setTimeout(() => startVoiceListeningRef.current(), 300);
    }
  }, [stopSpeaking, stopVoiceListening]);

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const imageItem = Array.from(e.clipboardData.items).find((item) =>
      item.type.startsWith('image/'),
    );
    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) {
        setImageFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setImagePreview(ev.target?.result as string);
        reader.readAsDataURL(file);
      }
    }
  };

  const startRename = (e: React.MouseEvent, s: Session) => {
    e.stopPropagation(); setRenamingId(s.id); setRenameValue(getTitle(s));
  };
  const commitRename = async (id: string) => {
    if (!renameValue.trim()) { cancelRename(); return; }
    setRenaming(true);
    try {
      await apiCall('PATCH', `/api/ai/session/${id}/rename`, { title: renameValue.trim() });
      setSessions((prev) => prev.map((s) => s.id === id ? { ...s, title: renameValue.trim() } : s));
      if (activeSession?.id === id) setActiveSession((prev) => prev ? { ...prev, title: renameValue.trim() } : prev);
    } catch { message.error('Failed to rename'); }
    finally { setRenaming(false); setRenamingId(null); }
  };
  const cancelRename = () => { setRenamingId(null); setRenameValue(''); };

  const confirmDelete = (e: React.MouseEvent, s: Session) => {
    e.stopPropagation();
    Modal.confirm({
      title: 'Delete this session?', content: 'This cannot be undone.',
      okText: 'Delete', okType: 'danger', cancelText: 'Cancel',
      onOk: async () => {
        try {
          await apiCall('DELETE', `/api/ai/session/${s.id}`);
          setSessions((prev) => prev.filter((x) => x.id !== s.id));
          if (activeSession?.id === s.id) setActiveSession(null);
        } catch { message.error('Failed to delete'); }
      },
    });
  };

  const getTitle = (s: Session) => {
    if (s.title) return s.title;
    const first = s.messages.find((m) => m.role === 'user');
    return first?.content?.slice(0, 50) || 'New chat';
  };

  const getDoctorForSession = (s: Session) => aiDoctors.find((d) => d.id === s.aiDoctorId);

  const filteredSessions = sessions.filter((s) =>
    !search || getTitle(s).toLowerCase().includes(search.toLowerCase())
    || s.messages.some((m) => m.content.toLowerCase().includes(search.toLowerCase()))
  );

  if (pageLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><Spin size="large" /></div>;
  }

  /* ── Tab: AI Doctors ── */
  const doctorsTab = (
    <div className="ai-doctors-tab" style={{ padding: '24px 28px', overflowY: 'auto', height: '100%' }}>
      {aiDoctors.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#bbb' }}>
          <TeamOutlined style={{ fontSize: 40, marginBottom: 12, display: 'block' }} />
          <Text type="secondary">No AI doctors available yet. Ask your admin to add some.</Text>
        </div>
      ) : (
        <div className="ai-doctors-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {aiDoctors.map((doc) => (
            <Card
              key={doc.id}
              bordered
              style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
              bodyStyle={{ padding: 20 }}
            >
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <Avatar
                  size={52}
                  src={doc.avatarUrl || undefined}
                  style={{ background: avatarColor(doc.name), fontSize: 20, fontWeight: 700, flexShrink: 0 }}
                >
                  {!doc.avatarUrl && doc.name.charAt(0).toUpperCase()}
                </Avatar>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#1a1a1a', marginBottom: 4 }}>{doc.name}</div>
                  {doc.specialty && (
                    <Tag color="purple" style={{ marginBottom: 8, fontSize: 11 }}>{doc.specialty}</Tag>
                  )}
                  {doc.description && (
                    <Text type="secondary" style={{ fontSize: 13, display: 'block', lineHeight: 1.5, marginBottom: 14 }}>
                      {doc.description.slice(0, 100)}{doc.description.length > 100 ? '…' : ''}
                    </Text>
                  )}
                  <Button
                    type="primary"
                    size="small"
                    icon={<MessageOutlined />}
                    loading={creatingId === doc.id}
                    onClick={() => void startNewSession(doc.id)}
                    style={{ borderRadius: 6 }}
                  >
                    Start Chat
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  /* ── Tab: Sessions (chat) ── */
  const sessionsTab = (
    <div className="ai-sessions-tab" style={{ display: 'flex', width: '100%', height: '100%' }}>

      {/* Sidebar */}
      <div className="ai-sidebar" style={{ width: 248, borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', background: '#fafafa', flexShrink: 0 }}>
        <div style={{ padding: '12px 12px 8px' }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            block
            onClick={() => void startNewSession()}
            loading={creatingId === 'generic'}
            style={{ borderRadius: 8 }}
          >
            New Session
          </Button>
        </div>
        <div style={{ padding: '0 12px 8px' }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear size="small"
            style={{ borderRadius: 6 }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredSessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#ccc' }}>
              <MessageOutlined style={{ fontSize: 28, marginBottom: 8, display: 'block' }} />
              <Text style={{ fontSize: 12, color: '#ccc' }}>No sessions yet</Text>
            </div>
          ) : filteredSessions.map((s) => {
            const isActive = activeSession?.id === s.id;
            const isRenaming = renamingId === s.id;
            const isHov = hoveredId === s.id;
            const doc = getDoctorForSession(s);

            const menuItems: MenuProps['items'] = [
              {
                key: 'rename', icon: <EditOutlined />, label: 'Rename',
                onClick: ({ domEvent }) => { domEvent.stopPropagation(); startRename(domEvent as unknown as React.MouseEvent, s); },
              },
              { type: 'divider' },
              {
                key: 'delete', icon: <DeleteOutlined />, label: 'Delete', danger: true,
                onClick: ({ domEvent }) => { domEvent.stopPropagation(); confirmDelete(domEvent as unknown as React.MouseEvent, s); },
              },
            ];

            return (
              <div
                key={s.id}
                onClick={() => selectSession(s)}
                onMouseEnter={() => setHoveredId(s.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  padding: '9px 12px',
                  cursor: 'pointer',
                  margin: '2px 8px',
                  borderRadius: 8,
                  background: isActive ? '#f0f5ff' : isHov ? '#f5f5f5' : 'transparent',
                  borderLeft: isActive ? '3px solid #1677ff' : '3px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {isRenaming ? (
                    <div style={{ display: 'flex', flex: 1, gap: 4 }} onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void commitRename(s.id);
                          if (e.key === 'Escape') cancelRename();
                        }}
                        style={{ flex: 1, fontSize: 13, border: '1px solid #1677ff', borderRadius: 4, padding: '2px 6px', outline: 'none' }}
                        disabled={renaming}
                      />
                      <Button type="text" size="small" icon={<CheckOutlined />}
                        onClick={() => void commitRename(s.id)} loading={renaming}
                        style={{ padding: 2, color: '#1677ff', minWidth: 0 }} />
                      <Button type="text" size="small" icon={<CloseOutlined />}
                        onClick={cancelRename} style={{ padding: 2, minWidth: 0 }} />
                    </div>
                  ) : (
                    <>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{
                          fontSize: 13, fontWeight: isActive ? 600 : 400,
                          color: isActive ? '#1677ff' : '#222',
                          display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {getTitle(s)}
                        </Text>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                          {doc && <Text style={{ fontSize: 11, color: '#aaa' }}>{doc.name}</Text>}
                          <span style={{
                            width: 5, height: 5, borderRadius: '50%',
                            background: s.isClosed ? '#d9d9d9' : '#52c41a',
                            display: 'inline-block',
                          }} />
                        </div>
                      </div>
                      {(isHov || isActive) && (
                        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
                          <Button
                            type="text" size="small"
                            icon={<MoreOutlined style={{ fontSize: 15 }} />}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: 22, height: 22, padding: 0, minWidth: 0, color: '#888' }}
                          />
                        </Dropdown>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!activeSession ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#bbb', gap: 12 }}>
            <RobotOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
            <Text type="secondary">Select a session or start a new one</Text>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => void startNewSession()} loading={creatingId === 'generic'}>
              New Session
            </Button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10 }}>
              {(() => {
                const doc = getDoctorForSession(activeSession);
                return (
                  <Avatar
                    size={34}
                    src={doc?.avatarUrl || undefined}
                    style={{ background: doc ? avatarColor(doc.name) : '#722ed1', fontSize: 14, fontWeight: 700, flexShrink: 0 }}
                  >
                    {doc ? doc.name.charAt(0).toUpperCase() : <RobotOutlined />}
                  </Avatar>
                );
              })()}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text strong style={{ display: 'block', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getTitle(activeSession)}
                </Text>
                {getDoctorForSession(activeSession) && (
                  <Text style={{ fontSize: 12, color: '#aaa' }}>
                    {getDoctorForSession(activeSession)?.name}
                    {getDoctorForSession(activeSession)?.specialty ? ` · ${getDoctorForSession(activeSession)?.specialty}` : ''}
                  </Text>
                )}
              </div>
              <Tag color={activeSession.isClosed ? 'default' : 'green'}>
                {activeSession.isClosed ? 'Closed' : 'Active'}
              </Tag>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', background: '#fafafa' }}>
              {(activeSession.messages ?? []).length === 0 && (
                <div style={{ textAlign: 'center', color: '#bbb', marginTop: 60 }}>
                  <RobotOutlined style={{ fontSize: 40, color: '#d9d9d9', marginBottom: 8, display: 'block' }} />
                  <Text type="secondary">Hi! Describe your symptoms and I&apos;ll help you.</Text>
                </div>
              )}
              {(activeSession.messages ?? []).map((msg, i) => (
                <div
                  key={msg.id ?? i}
                  style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 14, gap: 8, alignItems: 'flex-end' }}
                >
                  {msg.role === 'assistant' && (
                    <Avatar
                      size={30}
                      style={{ background: (() => { const d = getDoctorForSession(activeSession); return d ? avatarColor(d.name) : '#722ed1'; })(), flexShrink: 0, fontSize: 12, fontWeight: 700 }}
                    >
                      {(() => { const d = getDoctorForSession(activeSession); return d ? d.name.charAt(0).toUpperCase() : <RobotOutlined />; })()}
                    </Avatar>
                  )}
                  <div style={{
                    maxWidth: '68%',
                    background: msg.role === 'user' ? '#1677ff' : '#fff',
                    color: msg.role === 'user' ? '#fff' : '#1f2937',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    padding: '10px 14px', lineHeight: 1.65, fontSize: 14,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                  }}>
                    {msg.role === 'user' ? (
                      <>
                        {msg.imageUrl && (
                          <div style={{ marginBottom: msg.content ? 8 : 0 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={msg.imageUrl}
                              alt="uploaded"
                              style={{ maxWidth: 220, borderRadius: 10, display: 'block', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                            />
                          </div>
                        )}
                        {msg.content && msg.content !== 'Image sent for analysis.' && msg.content}
                        {!msg.content && !msg.imageUrl && null}
                      </>
                    ) : (
                      <>
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p style={{ margin: '4px 0' }}>{children}</p>,
                            strong: ({ children }) => <strong>{children}</strong>,
                            ul: ({ children }) => <ul style={{ paddingLeft: 18, margin: '4px 0' }}>{children}</ul>,
                            ol: ({ children }) => <ol style={{ paddingLeft: 18, margin: '4px 0' }}>{children}</ol>,
                            li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
                            hr: () => <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '8px 0' }} />,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                        {msg.imageUrl && (
                          <div style={{ marginTop: 10 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={msg.imageUrl}
                              alt="AI generated illustration"
                              style={{ width: '100%', maxWidth: 380, borderRadius: 10, display: 'block', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <Avatar icon={<UserOutlined />} size={30} style={{ background: '#e6f4ff', color: '#1677ff', flexShrink: 0 }} />
                  )}
                </div>
              ))}
              {sending && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 14 }}>
                  <Avatar size={30} style={{ background: '#722ed1', flexShrink: 0 }}><RobotOutlined /></Avatar>
                  <div style={{ background: '#fff', borderRadius: '16px 16px 16px 4px', padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                    <Spin size="small" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f0f0f0', background: '#fff' }}>
              {!activeSession.isClosed ? (
                voiceMode ? (
                  /* ── Voice mode ── */
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                    {/* Status line */}
                    <div style={{ height: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {speaking ? (
                        <>
                          <SoundOutlined style={{ color: '#1677ff', fontSize: 15 }} />
                          <Text style={{ color: '#1677ff', fontSize: 13 }}>AI is speaking…</Text>
                          <Button size="small" type="text" onClick={stopSpeaking} style={{ color: '#ff4d4f', padding: '0 4px', height: 'auto', fontSize: 12 }}>Stop</Button>
                        </>
                      ) : listening ? (
                        <Text style={{ color: '#52c41a', fontSize: 13 }}>Listening… speak now</Text>
                      ) : sending ? (
                        <><Spin size="small" /><Text style={{ color: '#faad14', fontSize: 13, marginLeft: 6 }}>Thinking…</Text></>
                      ) : (
                        <Text style={{ color: '#aaa', fontSize: 13 }}>Tap the mic to speak</Text>
                      )}
                    </div>

                    {/* Mic button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                      <button
                        onClick={listening ? stopVoiceListening : startVoiceListening}
                        disabled={sending || speaking}
                        style={{
                          width: 68, height: 68, borderRadius: '50%', border: 'none',
                          background: listening ? '#ff4d4f' : '#1677ff',
                          cursor: sending || speaking ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: listening
                            ? '0 0 0 10px rgba(255,77,79,0.15), 0 0 0 20px rgba(255,77,79,0.07)'
                            : '0 4px 14px rgba(22,119,255,0.35)',
                          transition: 'all 0.2s',
                          opacity: sending || speaking ? 0.5 : 1,
                        }}
                      >
                        <AudioOutlined style={{ color: '#fff', fontSize: 26 }} />
                      </button>
                      <Button type="text" size="small" onClick={toggleVoiceMode} style={{ color: '#bbb', fontSize: 12 }}>
                        Exit voice
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* ── Text mode ── */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {imagePreview && (
                      <div style={{ position: 'relative', display: 'inline-block', alignSelf: 'flex-start' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imagePreview} alt="preview" style={{ height: 80, width: 80, objectFit: 'cover', borderRadius: 10, border: '2px solid #1677ff', display: 'block' }} />
                        <button onClick={removeImage} style={{ position: 'absolute', top: -8, right: -8, background: '#ff4d4f', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                          <CloseCircleOutlined style={{ color: '#fff', fontSize: 12 }} />
                        </button>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleImageSelect} />
                      <Button icon={<CameraOutlined />} size="large" onClick={() => fileInputRef.current?.click()} disabled={sending} title="Upload image" style={{ borderRadius: 10, flexShrink: 0, color: imageFile ? '#1677ff' : undefined, borderColor: imageFile ? '#1677ff' : undefined }} />
                      <Button icon={<AudioOutlined />} size="large" onClick={toggleVoiceMode} disabled={sending} title="Switch to voice mode" style={{ borderRadius: 10, flexShrink: 0 }} />
                      <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onPressEnter={sendMessage}
                        onPaste={handlePaste}
                        placeholder={imageFile ? 'Add a description (optional)...' : 'Describe symptoms or paste / upload an image...'}
                        size="large" disabled={sending} style={{ borderRadius: 10, flex: '1 1 auto', minWidth: 0 }}
                      />
                      <Button type="primary" icon={<SendOutlined />} size="large" onClick={sendMessage} loading={sending} disabled={!input.trim() && !imageFile} style={{ borderRadius: 10, flexShrink: 0 }}>Send</Button>
                    </div>
                  </div>
                )
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary">This session is closed. </Text>
                  <Button type="link" onClick={() => void startNewSession()}>Start a new session</Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  const tabs = [
    { key: 'doctors', icon: <TeamOutlined />, label: 'AI Doctors' },
    {
      key: 'sessions', icon: <MessageOutlined />, label: 'Sessions',
      badge: sessions.length > 0 ? sessions.length : undefined,
    },
  ];

  return (
    <div style={{ height: 'calc(100vh - 112px)', background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column' }}>

      {/* Custom tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', flexShrink: 0, padding: '0 4px' }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '12px 18px',
              border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: activeTab === t.key ? 600 : 400,
              color: activeTab === t.key ? '#1677ff' : '#666',
              borderBottom: activeTab === t.key ? '2px solid #1677ff' : '2px solid transparent',
              marginBottom: -1,
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {t.icon}
            {t.label}
            {t.badge !== undefined && (
              <span style={{
                background: '#1677ff', color: '#fff',
                borderRadius: 10, fontSize: 11,
                padding: '0 6px', lineHeight: '18px',
              }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content — fills all remaining height */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: activeTab === 'doctors' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'auto' }}>
          {doctorsTab}
        </div>
        <div style={{ display: activeTab === 'sessions' ? 'flex' : 'none', flex: 1, overflow: 'hidden' }}>
          {sessionsTab}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .ai-sessions-tab {
            flex-direction: column;
          }
          .ai-sidebar {
            width: 100% !important;
            max-height: 40%;
            border-right: none !important;
            border-bottom: 1px solid #f0f0f0;
          }
          .ai-doctors-tab {
            padding: 16px !important;
          }
          .ai-doctors-grid {
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)) !important;
          }
        }
      `}</style>
    </div>
  );
}
