'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { Button, Input, Tag, Spin, Typography, Pagination } from 'antd';
import { PhoneOutlined, SearchOutlined, ReloadOutlined, CheckCircleOutlined, SoundOutlined } from '@ant-design/icons';
import { apiCall } from '../../../lib/api';

const { Title, Text } = Typography;

type TranscriptItem = { id?: string; type: string; role?: string; content?: string[] | string; created_at?: number };

interface AgentCall {
  id: string;
  agentId: string;
  callType: string;
  fromNumber?: string;
  toNumber?: string;
  status: string;
  durationSeconds?: number;
  summary?: string;
  transcript?: unknown;
  recordingUrl?: string;
  bookingCreated: boolean;
  createdAt: string;
}

type ConversationCall = AgentCall & { agentDisplayName?: string };

// ─── Recording Player ─────────────────────────────────────────────────────────
function RecordingPlayer({ callId }: { callId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiCall('GET', `/api/doctor/voice-agents/calls/${callId}/recording`)
      .then((res) => setUrl((res.data ?? res)?.url ?? null))
      .catch(() => setUrl(null))
      .finally(() => setLoading(false));
  }, [callId]);

  if (loading) return <Spin size="small" />;
  if (!url) return <Text type="secondary" style={{ fontSize: 12 }}>Recording not available.</Text>;

  return (
    <audio
      controls
      src={url}
      style={{ width: '100%', height: 36 }}
    />
  );
}

// ─── Call Detail ──────────────────────────────────────────────────────────────
function CallDetail({ call, onBack }: { call: ConversationCall; onBack: () => void }) {
  const chatHistory = call.transcript as { items?: TranscriptItem[] } | null;
  const messages = (chatHistory?.items ?? []).filter((i) => i.type === 'message' && i.role);

  return (
    <div>
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1677ff', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
      >
        ← Back to conversations
      </button>

      {/* Details + Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10, padding: '16px 20px' }}>
          <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>Call Details</Text>
          {([
            ['Agent', call.agentDisplayName ?? '—'],
            ['Date', new Date(call.createdAt).toLocaleString()],
            ['Duration', call.durationSeconds ? `${Math.floor(call.durationSeconds / 60)}m ${call.durationSeconds % 60}s` : '—'],
            ['Type', call.callType],
            ['Status', call.status],
            ['From', call.fromNumber ?? '—'],
            ['To', call.toNumber ?? '—'],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
              <Text style={{ fontSize: 12 }}>{value}</Text>
            </div>
          ))}
        </div>

        {call.summary && (
          <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10, padding: '16px 20px' }}>
            <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Call Summary</Text>
            <Text style={{ fontSize: 13, lineHeight: 1.6, color: '#444' }}>{call.summary}</Text>
          </div>
        )}
      </div>

      {/* Recording */}
      {call.recordingUrl && (
        <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10, padding: '16px 20px', marginBottom: 16 }}>
          <Text strong style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 13 }}>
            <SoundOutlined style={{ color: '#1677ff' }} /> Recording
          </Text>
          <RecordingPlayer callId={call.id} />
        </div>
      )}

      {/* Transcript */}
      <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10, padding: '16px 20px' }}>
        <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>Transcript</Text>
        {messages.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12 }}>No transcript available for this call.</Text>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 480, overflowY: 'auto', paddingRight: 4 }}>
            {messages.map((msg, i) => {
              const isAgent = msg.role === 'assistant';
              const text = Array.isArray(msg.content)
                ? (msg.content as string[]).join(' ')
                : String(msg.content ?? '');
              if (!text.trim()) return null;
              return (
                <div key={msg.id ?? i} style={{ display: 'flex', justifyContent: isAgent ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '75%', padding: '9px 14px', fontSize: 13, lineHeight: 1.55,
                    borderRadius: isAgent ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: isAgent ? '#e6f4ff' : '#f5f5f5',
                    color: '#333',
                  }}>
                    <div style={{ fontSize: 10, color: '#999', marginBottom: 3 }}>{isAgent ? 'Agent' : 'User'}</div>
                    {text}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Conversations Page ────────────────────────────────────────────────────────
export default function ConversationsPage() {
  const [calls, setCalls] = useState<ConversationCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ConversationCall | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  const fetchCalls = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await apiCall('GET', `/api/doctor/voice-agents/calls?page=${p}&limit=${pageSize}`);
      const payload = res.data ?? res;
      if (payload && typeof payload === 'object' && 'data' in payload) {
        setCalls((payload as { data: ConversationCall[]; total: number }).data ?? []);
        setTotal((payload as { total: number }).total ?? 0);
      } else {
        setCalls((payload as ConversationCall[]) ?? []);
        setTotal(((payload as ConversationCall[]) ?? []).length);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchCalls(page); }, [page, fetchCalls]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (selected) {
    return (
      <div>
        <Title level={4} style={{ marginBottom: 20 }}>Conversations</Title>
        <CallDetail call={selected} onBack={() => setSelected(null)} />
      </div>
    );
  }

  const filtered = calls.filter((c) => {
    const q = search.toLowerCase();
    return !q
      || (c.fromNumber ?? '').includes(q)
      || (c.toNumber ?? '').includes(q)
      || (c.agentDisplayName ?? '').toLowerCase().includes(q)
      || (c.summary ?? '').toLowerCase().includes(q);
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Conversations</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>All call history across your voice agents</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => { if (page === 1) void fetchCalls(1); else setPage(1); }}>Refresh</Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#ccc' }} />}
          placeholder="Search by caller, agent name, or summary..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 400 }}
          allowClear
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📞</div>
          <Text type="secondary" style={{ fontSize: 14 }}>
            {search
              ? 'No conversations match your search.'
              : 'No conversations yet. Calls will appear here after your agents receive calls.'}
          </Text>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((call) => (
              <div
                key={call.id}
                onClick={() => setSelected(call)}
                style={{
                  background: '#fff', border: '1px solid #f0f0f0', borderRadius: 12,
                  padding: '16px 20px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'box-shadow 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 10px rgba(0,0,0,0.07)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
              >
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#f0f7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <PhoneOutlined style={{ color: '#1677ff', fontSize: 18 }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                      {call.agentDisplayName && (
                        <Text strong style={{ fontSize: 13 }}>{call.agentDisplayName}</Text>
                      )}
                      <Tag color={call.callType === 'inbound' ? 'blue' : 'purple'} style={{ borderRadius: 20, margin: 0, fontSize: 11 }}>
                        {call.callType}
                      </Tag>
                      <Tag
                        color={call.status === 'completed' ? 'success' : call.status === 'failed' ? 'error' : 'processing'}
                        style={{ borderRadius: 20, margin: 0, fontSize: 11 }}
                      >
                        {call.status}
                      </Tag>
                      {call.bookingCreated && (
                        <Tag color="green" style={{ borderRadius: 20, margin: 0, fontSize: 11 }}>
                          <CheckCircleOutlined /> Booked
                        </Tag>
                      )}
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {call.fromNumber ? `From ${call.fromNumber}` : 'Web call'}
                      {call.durationSeconds
                        ? ` · ${Math.floor(call.durationSeconds / 60)}m ${call.durationSeconds % 60}s`
                        : ''}
                      {` · ${new Date(call.createdAt).toLocaleString()}`}
                    </Text>
                    {call.summary && (
                      <Text
                        type="secondary"
                        style={{ fontSize: 12, display: 'block', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '600px' }}
                      >
                        {call.summary}
                      </Text>
                    )}
                  </div>
                </div>
                <Text type="secondary" style={{ fontSize: 13, flexShrink: 0, marginLeft: 12 }}>View →</Text>
              </div>
            ))}
          </div>
          {!search && total > pageSize && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
              <Pagination
                current={page}
                total={total}
                pageSize={pageSize}
                onChange={handlePageChange}
                showSizeChanger={false}
                showTotal={(t) => `${t} conversations`}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
