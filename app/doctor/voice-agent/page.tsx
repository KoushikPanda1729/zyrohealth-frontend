'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { VoicePlayground } from './VoicePlayground';
import {
  Button, Table, Tag, Input, Switch, Dropdown, Drawer, Modal,
  Spin, Typography, Tooltip, message, Select, Space,
} from 'antd';
import {
  PlusOutlined, ArrowLeftOutlined, HistoryOutlined,
  PhoneOutlined, DeleteOutlined, ReloadOutlined, CheckCircleOutlined,
  MoreOutlined, SearchOutlined,
} from '@ant-design/icons';
import { apiCall, api } from '../../../lib/api';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ─── Types ────────────────────────────────────────────────────────────────────
interface VoiceAgent { id: string; name: string; displayName: string; active: boolean; deployedVersionId?: string; createdAt: string; }
interface AgentDraft { prompt?: string; welcomeMessage?: string; welcomeAllowInterruptions: boolean; allowInterruptions: boolean; minInterruptionDuration: number; minInterruptionWords: number; language: string; llmProvider: string; llmModel: string; llmTemperature: number; sttProvider: string; sttModel: string; ttsProvider: string; ttsModel: string; ttsVoiceId?: string; ttsLanguage: string; ttsVoiceSettings?: Record<string, number | boolean>; }
interface AgentVersion { id: string; version: number; deploymentStatus?: string; publishedAt: string; llmModel: string; }
interface AgentCall { id: string; agentId: string; callType: string; fromNumber?: string; toNumber?: string; status: string; durationSeconds?: number; summary?: string; transcript?: unknown; bookingCreated: boolean; createdAt: string; }

// ─── Static data ──────────────────────────────────────────────────────────────
const VOICES = [
  { id: 'ePn9OncKq8KyJvrTRqTi', name: 'James',    gender: 'Male',   accent: 'American',   preview: 'https://storage.googleapis.com/eleven-public-prod/database/user/tS0MEWOjZNcBpe25duraYAR1Ryw1/voices/ePn9OncKq8KyJvrTRqTi/J08opxkeKStcnTkMECnI.mp3' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger',    gender: 'Male',   accent: 'American',   preview: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/CwhRBWXzGAHq8TQ4Fs17/58ee3ff5-f6f2-4628-93b8-e38eb31806b0.mp3' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie',  gender: 'Male',   accent: 'Australian', preview: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/IKne3meq5aSn9XLyUdCD/102de6f2-22ed-43e0-a1f1-111fa75c5481.mp3' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George',   gender: 'Male',   accent: 'British',    preview: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/JBFqnCBsd6RMkjVDRZzb/e6206d1a-0721-4787-aafb-06a6e705cac5.mp3' },
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum',   gender: 'Male',   accent: 'American',   preview: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/N2lVS1w4EtoT3dr4eOWO/ac833bd8-ffda-4938-9ebc-b0f99ca25481.mp3' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam',     gender: 'Male',   accent: 'American',   preview: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/TX3LPaxmHKxFdv7VOQHJ/63148076-6363-42db-aea8-31424308b92c.mp3' },
  { id: 'bIHbv24MWmeRgasZH58o', name: 'Will',     gender: 'Male',   accent: 'American',   preview: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/bIHbv24MWmeRgasZH58o/8caf8f3d-ad29-4980-af41-53f20c72d7a4.mp3' },
  { id: 'cjVigY5qzO86Huf0OWal', name: 'Eric',     gender: 'Male',   accent: 'American',   preview: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/cjVigY5qzO86Huf0OWal/d098fda0-6456-4030-b3d8-63aa048c9070.mp3' },
  { id: 'iP95p4xoKVk53GoZ742B', name: 'Chris',    gender: 'Male',   accent: 'American',   preview: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/iP95p4xoKVk53GoZ742B/3f4bde72-cc48-40dd-829f-57fbf906f4d7.mp3' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel',   gender: 'Male',   accent: 'British',    preview: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/onwK4e9ZLuTAKqWW03F9/7eee0236-1a72-4b86-b303-5dcadc007ba9.mp3' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam',     gender: 'Male',   accent: 'American',   preview: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/pNInz6obpgDQGcFmaJgB/d6905d7a-dd26-4187-bfff-1bd3a5ea7cac.mp3' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah',    gender: 'Female', accent: 'American',   preview: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee7-8543-ff2216a32186.mp3' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura',    gender: 'Female', accent: 'American',   preview: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/FGY2WhTYpPnrIDTdsKH5/67341759-ad08-41a5-be6e-de12fe448618.mp3' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda',  gender: 'Female', accent: 'American',   preview: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/XrExE9yKIg1WjnnlVkGX/b930e18d-6b4d-466e-bab2-0ae97c6d8535.mp3' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice',    gender: 'Female', accent: 'British',    preview: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/Xb7hH8MSUJpSbSDYk0k2/d10f7534-11f6-41fe-a012-2de1e482d336.mp3' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica',  gender: 'Female', accent: 'American',   preview: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/cgSgspJ2msm6clMCkdW9/56a97bf8-b69b-448f-846c-c3a11683d45a.mp3' },
  { id: 'HpyxY047iEZzSG1aUPfx', name: 'Samantha', gender: 'Female', accent: 'American',   preview: 'https://storage.googleapis.com/eleven-public-prod/Q1eMIeDEBxZzQK2QXJ8xP5OXJCU2/voices/HpyxY047iEZzSG1aUPfx/a35bb92b-7a10-4f26-9aee-2a47068cc1b4.mp3' },
];

const STT_MODELS: Record<string, { label: string; value: string }[]> = {
  deepgram:   [{ label: 'Nova 3 (Recommended)', value: 'nova-3' }, { label: 'Nova 2', value: 'nova-2' }, { label: 'Enhanced', value: 'enhanced' }],
  elevenlabs: [{ label: 'Scribe v2 Realtime (Recommended)', value: 'scribe_v2_realtime' }],
  sarvam:     [{ label: 'Saaras v3 (Recommended)', value: 'saaras:v3' }, { label: 'Saarika v2.5', value: 'saarika:v2.5' }],
};
const LLM_MODELS: Record<string, { label: string; value: string }[]> = {
  openai:    [{ label: 'GPT-4o Mini (Recommended)', value: 'gpt-4o-mini' }, { label: 'GPT-4o', value: 'gpt-4o' }],
  anthropic: [{ label: 'Claude 3.5 Haiku (Recommended)', value: 'claude-haiku-4-5-20251001' }, { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' }],
};
const TTS_MODELS: Record<string, { label: string; value: string }[]> = {
  elevenlabs: [{ label: 'Flash v2.5 (Recommended)', value: 'eleven_flash_v2_5' }, { label: 'Multilingual v2', value: 'eleven_multilingual_v2' }],
  openai:     [{ label: 'TTS-1 HD (Recommended)', value: 'tts-1-hd' }, { label: 'TTS-1', value: 'tts-1' }],
  google:     [{ label: 'WaveNet (Recommended)', value: 'wavenet' }, { label: 'Standard', value: 'standard' }, { label: 'Neural2', value: 'neural2' }],
  sarvam:     [{ label: 'Bulbul v3 (Recommended)', value: 'bulbul:v3' }, { label: 'Bulbul v2', value: 'bulbul:v2' }],
};

const SARVAM_SPEAKERS: Record<string, { id: string; name: string; gender: string }[]> = {
  'bulbul:v3': [
    { id: 'shubh',    name: 'Shubh',    gender: 'Male'   }, { id: 'aditya',   name: 'Aditya',   gender: 'Male'   },
    { id: 'ritu',     name: 'Ritu',     gender: 'Female' }, { id: 'priya',    name: 'Priya',    gender: 'Female' },
    { id: 'neha',     name: 'Neha',     gender: 'Female' }, { id: 'rahul',    name: 'Rahul',    gender: 'Male'   },
    { id: 'pooja',    name: 'Pooja',    gender: 'Female' }, { id: 'rohan',    name: 'Rohan',    gender: 'Male'   },
    { id: 'simran',   name: 'Simran',   gender: 'Female' }, { id: 'kavya',    name: 'Kavya',    gender: 'Female' },
    { id: 'amit',     name: 'Amit',     gender: 'Male'   }, { id: 'dev',      name: 'Dev',      gender: 'Male'   },
    { id: 'ishita',   name: 'Ishita',   gender: 'Female' }, { id: 'shreya',   name: 'Shreya',   gender: 'Female' },
    { id: 'ratan',    name: 'Ratan',    gender: 'Male'   }, { id: 'varun',    name: 'Varun',    gender: 'Male'   },
    { id: 'manan',    name: 'Manan',    gender: 'Male'   }, { id: 'sumit',    name: 'Sumit',    gender: 'Male'   },
    { id: 'roopa',    name: 'Roopa',    gender: 'Female' }, { id: 'kabir',    name: 'Kabir',    gender: 'Male'   },
    { id: 'aayan',    name: 'Aayan',    gender: 'Male'   }, { id: 'ashutosh', name: 'Ashutosh', gender: 'Male'   },
    { id: 'advait',   name: 'Advait',   gender: 'Male'   }, { id: 'anand',    name: 'Anand',    gender: 'Male'   },
    { id: 'tanya',    name: 'Tanya',    gender: 'Female' }, { id: 'tarun',    name: 'Tarun',    gender: 'Male'   },
    { id: 'sunny',    name: 'Sunny',    gender: 'Male'   }, { id: 'mani',     name: 'Mani',     gender: 'Male'   },
    { id: 'gokul',    name: 'Gokul',    gender: 'Male'   }, { id: 'vijay',    name: 'Vijay',    gender: 'Male'   },
    { id: 'shruti',   name: 'Shruti',   gender: 'Female' }, { id: 'suhani',   name: 'Suhani',   gender: 'Female' },
    { id: 'mohit',    name: 'Mohit',    gender: 'Male'   }, { id: 'kavitha',  name: 'Kavitha',  gender: 'Female' },
    { id: 'rehan',    name: 'Rehan',    gender: 'Male'   }, { id: 'soham',    name: 'Soham',    gender: 'Male'   },
    { id: 'rupali',   name: 'Rupali',   gender: 'Female' },
  ],
  'bulbul:v2': [
    { id: 'anushka',  name: 'Anushka',  gender: 'Female' }, { id: 'manisha',  name: 'Manisha',  gender: 'Female' },
    { id: 'vidya',    name: 'Vidya',    gender: 'Female' }, { id: 'arya',     name: 'Arya',     gender: 'Female' },
    { id: 'abhilash', name: 'Abhilash', gender: 'Male'   }, { id: 'karun',    name: 'Karun',    gender: 'Male'   },
    { id: 'hitesh',   name: 'Hitesh',   gender: 'Male'   },
  ],
};

const OPENAI_VOICES: { id: string; name: string; gender: string; description: string }[] = [
  { id: 'onyx',    name: 'Onyx',    gender: 'Male',   description: 'Deep & authoritative' },
  { id: 'echo',    name: 'Echo',    gender: 'Male',   description: 'Warm & natural' },
  { id: 'fable',   name: 'Fable',   gender: 'Male',   description: 'Expressive & dynamic' },
  { id: 'nova',    name: 'Nova',    gender: 'Female', description: 'Warm & friendly' },
  { id: 'shimmer', name: 'Shimmer', gender: 'Female', description: 'Clear & pleasant' },
  { id: 'alloy',   name: 'Alloy',   gender: 'Female', description: 'Neutral & balanced' },
];

const GOOGLE_VOICES: { id: string; name: string; gender: string; lang: string; quality: string }[] = [
  // Bengali (best quality first)
  { id: 'bn-IN-Wavenet-B',  name: 'WaveNet B',  gender: 'Male',   lang: 'bn', quality: 'WaveNet' },
  { id: 'bn-IN-Wavenet-A',  name: 'WaveNet A',  gender: 'Female', lang: 'bn', quality: 'WaveNet' },
  { id: 'bn-IN-Standard-B', name: 'Standard B', gender: 'Male',   lang: 'bn', quality: 'Standard' },
  { id: 'bn-IN-Standard-A', name: 'Standard A', gender: 'Female', lang: 'bn', quality: 'Standard' },
  // Hindi
  { id: 'hi-IN-Wavenet-B',  name: 'WaveNet B',  gender: 'Male',   lang: 'hi', quality: 'WaveNet' },
  { id: 'hi-IN-Wavenet-A',  name: 'WaveNet A',  gender: 'Female', lang: 'hi', quality: 'WaveNet' },
  { id: 'hi-IN-Standard-B', name: 'Standard B', gender: 'Male',   lang: 'hi', quality: 'Standard' },
  { id: 'hi-IN-Standard-A', name: 'Standard A', gender: 'Female', lang: 'hi', quality: 'Standard' },
  // English
  { id: 'en-US-Neural2-J',  name: 'Neural2 J',  gender: 'Male',   lang: 'en', quality: 'Neural2' },
  { id: 'en-US-Neural2-F',  name: 'Neural2 F',  gender: 'Female', lang: 'en', quality: 'Neural2' },
  { id: 'en-US-Wavenet-D',  name: 'WaveNet D',  gender: 'Male',   lang: 'en', quality: 'WaveNet' },
  { id: 'en-US-Wavenet-F',  name: 'WaveNet F',  gender: 'Female', lang: 'en', quality: 'WaveNet' },
  // Spanish
  { id: 'es-ES-Neural2-B',  name: 'Neural2 B',  gender: 'Male',   lang: 'es', quality: 'Neural2' },
  { id: 'es-ES-Neural2-A',  name: 'Neural2 A',  gender: 'Female', lang: 'es', quality: 'Neural2' },
  // French
  { id: 'fr-FR-Neural2-B',  name: 'Neural2 B',  gender: 'Male',   lang: 'fr', quality: 'Neural2' },
  { id: 'fr-FR-Neural2-A',  name: 'Neural2 A',  gender: 'Female', lang: 'fr', quality: 'Neural2' },
];
const LANGUAGES = [
  { label: 'English', value: 'en' }, { label: 'Bengali', value: 'bn' },
  { label: 'Hindi', value: 'hi' }, { label: 'Spanish', value: 'es' },
  { label: 'French', value: 'fr' },
];

const defaultDraft = (): AgentDraft => ({
  prompt: '', welcomeMessage: '', welcomeAllowInterruptions: true,
  allowInterruptions: true, minInterruptionDuration: 0.5, minInterruptionWords: 2,
  language: 'en', llmProvider: 'openai', llmModel: 'gpt-4o-mini', llmTemperature: 0.3,
  sttProvider: 'deepgram', sttModel: 'nova-3',
  ttsProvider: 'elevenlabs', ttsModel: 'eleven_flash_v2_5',
  ttsVoiceId: 'ePn9OncKq8KyJvrTRqTi', ttsLanguage: 'en',
  ttsVoiceSettings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 1.0 },
});

// ─── Slider ───────────────────────────────────────────────────────────────────
function SettingSlider({ label, description, min, max, step, value, onChange }: { label: string; description?: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; }) {
  const num = Number(value) || 0;
  const pct = ((num - min) / (max - min)) * 100;
  return (
    <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: '14px 18px', marginBottom: 12 }}>
      <Text strong style={{ fontSize: 14 }}>{label}</Text>
      {description && <div style={{ color: '#888', fontSize: 12, marginTop: 2, marginBottom: 10 }}>{description}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1, position: 'relative', height: 6 }}>
          <div style={{ position: 'absolute', inset: 0, background: '#e5e7eb', borderRadius: 3 }} />
          <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${pct}%`, background: '#1677ff', borderRadius: 3 }} />
          <input type="range" min={min} max={max} step={step} value={num} onChange={(e) => onChange(parseFloat(e.target.value))}
            style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer', height: '100%', margin: 0 }} />
          <div style={{ position: 'absolute', top: '50%', left: `${pct}%`, transform: 'translate(-50%,-50%)', width: 16, height: 16, borderRadius: '50%', background: '#1677ff', border: '2px solid #fff', pointerEvents: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
        </div>
        <div style={{ background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: 6, padding: '3px 10px', fontSize: 13, minWidth: 50, textAlign: 'center' }}>{num.toFixed(2)}</div>
      </div>
    </div>
  );
}

// ─── Voice picker ─────────────────────────────────────────────────────────────
function VoicePicker({ selected, onSelect, gender }: { selected: string; onSelect: (id: string) => void; gender: string }) {
  const list = VOICES.filter((v) => gender === 'All' || v.gender === gender);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [playingVoice, setPlayingVoice] = React.useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = React.useState<string | null>(null);

  const handlePlay = (e: React.MouseEvent, v: typeof VOICES[0]) => {
    e.stopPropagation();
    onSelect(v.id);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (playingVoice === v.id) {
      setPlayingVoice(null);
      return;
    }
    setLoadingVoice(v.id);
    const audio = new Audio(v.preview);
    audioRef.current = audio;
    audio.oncanplay = () => setLoadingVoice(null);
    audio.onended = () => setPlayingVoice(null);
    audio.onerror = () => { setLoadingVoice(null); setPlayingVoice(null); };
    audio.play().then(() => { setPlayingVoice(v.id); setLoadingVoice(null); }).catch(() => { setLoadingVoice(null); setPlayingVoice(null); });
  };

  React.useEffect(() => () => { audioRef.current?.pause(); }, []);

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <div style={{ display: 'flex', gap: 18, paddingBottom: 4 }}>
        {list.map((v) => {
          const active = selected === v.id;
          const isPlaying = playingVoice === v.id;
          const isLoading = loadingVoice === v.id;
          return (
            <div key={v.id} onClick={() => onSelect(v.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', flexShrink: 0 }}>
              <div
                onClick={(e) => handlePlay(e, v)}
                style={{ width: 58, height: 58, borderRadius: '50%', border: `2px solid ${active ? '#1677ff' : '#e5e7eb'}`, background: active ? '#e6f4ff' : '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
              >
                {isLoading ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1677ff" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" strokeOpacity="0.2" /><path d="M12 2a10 10 0 0 1 10 10"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" /></path></svg>
                ) : isPlaying ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? '#1677ff' : '#bbb'}><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? '#1677ff' : '#bbb'}><path d="M8 5v14l11-7z" /></svg>
                )}
              </div>
              <Text style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? '#1677ff' : '#333' }}>{v.name}</Text>
              <Text style={{ fontSize: 10, color: '#999' }}>{v.gender} • {v.accent}</Text>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Speaker icon (no preview) ───────────────────────────────────────────────
function SpeakerIcon({ color = '#bbb' }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={color}>
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
    </svg>
  );
}

// ─── Google Voice Picker ──────────────────────────────────────────────────────
function GoogleVoicePicker({ selected, onSelect, gender, lang }: { selected: string; onSelect: (id: string) => void; gender: string; lang: string }) {
  const list = GOOGLE_VOICES.filter((v) => v.lang === lang && (gender === 'All' || v.gender === gender));
  if (list.length === 0) {
    return <Text type="secondary" style={{ fontSize: 12 }}>No Google voices available for this language. Try switching to ElevenLabs or changing the language.</Text>;
  }
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', paddingBottom: 4 }}>
        {list.map((v) => {
          const active = selected === v.id;
          return (
            <div key={v.id} onClick={() => onSelect(v.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', flexShrink: 0 }}>
              <div style={{ width: 58, height: 58, borderRadius: '50%', border: `2px solid ${active ? '#1677ff' : '#e5e7eb'}`, background: active ? '#e6f4ff' : '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                <SpeakerIcon color={active ? '#1677ff' : '#bbb'} />
              </div>
              <Text style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? '#1677ff' : '#333' }}>{v.name}</Text>
              <Text style={{ fontSize: 10, color: '#999' }}>{v.gender} • {v.quality}</Text>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── OpenAI Voice Picker ──────────────────────────────────────────────────────
function OpenAIVoicePicker({ selected, onSelect, gender }: { selected: string; onSelect: (id: string) => void; gender: string }) {
  const list = OPENAI_VOICES.filter((v) => gender === 'All' || v.gender === gender);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [playingVoice, setPlayingVoice] = React.useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = React.useState<string | null>(null);

  const handlePlay = async (e: React.MouseEvent, voiceId: string) => {
    e.stopPropagation();
    onSelect(voiceId);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    if (playingVoice === voiceId) { setPlayingVoice(null); return; }
    setLoadingVoice(voiceId);
    try {
      const res = await api.get(`/api/doctor/voice-agents/tts-preview?provider=openai&voiceId=${voiceId}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setPlayingVoice(null); URL.revokeObjectURL(url); };
      audio.onerror = () => { setLoadingVoice(null); setPlayingVoice(null); };
      await audio.play();
      setPlayingVoice(voiceId);
      setLoadingVoice(null);
    } catch { setLoadingVoice(null); setPlayingVoice(null); }
  };

  React.useEffect(() => () => { audioRef.current?.pause(); }, []);

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <div style={{ display: 'flex', gap: 18, paddingBottom: 4 }}>
        {list.map((v) => {
          const active = selected === v.id;
          const isPlaying = playingVoice === v.id;
          const isLoading = loadingVoice === v.id;
          return (
            <div key={v.id} onClick={() => onSelect(v.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', flexShrink: 0 }}>
              <div
                onClick={(e) => void handlePlay(e, v.id)}
                style={{ width: 58, height: 58, borderRadius: '50%', border: `2px solid ${active ? '#1677ff' : '#e5e7eb'}`, background: active ? '#e6f4ff' : '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
              >
                {isLoading ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1677ff" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" strokeOpacity="0.2" /><path d="M12 2a10 10 0 0 1 10 10"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" /></path></svg>
                ) : isPlaying ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? '#1677ff' : '#bbb'}><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? '#1677ff' : '#bbb'}><path d="M8 5v14l11-7z" /></svg>
                )}
              </div>
              <Text style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? '#1677ff' : '#333' }}>{v.name}</Text>
              <Text style={{ fontSize: 10, color: '#999' }}>{v.gender} • {v.description}</Text>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sarvam Voice Picker ──────────────────────────────────────────────────────
function SarvamVoicePicker({ selected, onSelect, gender, model }: { selected: string; onSelect: (id: string) => void; gender: string; model: string }) {
  const speakers = (SARVAM_SPEAKERS[model] ?? SARVAM_SPEAKERS['bulbul:v3']).filter((s) => gender === 'All' || s.gender === gender);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [playingVoice, setPlayingVoice] = React.useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = React.useState<string | null>(null);

  const handlePlay = async (e: React.MouseEvent, speakerId: string) => {
    e.stopPropagation();
    onSelect(speakerId);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    if (playingVoice === speakerId) { setPlayingVoice(null); return; }
    setLoadingVoice(speakerId);
    try {
      const res = await api.get(`/api/doctor/voice-agents/tts-preview?provider=sarvam&voiceId=${speakerId}&model=${encodeURIComponent(model)}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setPlayingVoice(null); URL.revokeObjectURL(url); };
      audio.onerror = () => { setLoadingVoice(null); setPlayingVoice(null); };
      await audio.play();
      setPlayingVoice(speakerId);
      setLoadingVoice(null);
    } catch { setLoadingVoice(null); setPlayingVoice(null); }
  };

  React.useEffect(() => () => { audioRef.current?.pause(); }, []);

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, paddingBottom: 4 }}>
        {speakers.map((s) => {
          const active = selected === s.id;
          const isPlaying = playingVoice === s.id;
          const isLoading = loadingVoice === s.id;
          return (
            <div key={s.id} onClick={() => onSelect(s.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', flexShrink: 0 }}>
              <div
                onClick={(e) => void handlePlay(e, s.id)}
                style={{ width: 52, height: 52, borderRadius: '50%', border: `2px solid ${active ? '#1677ff' : '#e5e7eb'}`, background: active ? '#e6f4ff' : '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
              >
                {isLoading ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1677ff" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" strokeOpacity="0.2" /><path d="M12 2a10 10 0 0 1 10 10"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" /></path></svg>
                ) : isPlaying ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={active ? '#1677ff' : '#bbb'}><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? '#1677ff' : '#bbb'}><path d="M8 5v14l11-7z" /></svg>
                )}
              </div>
              <Text style={{ fontSize: 11, fontWeight: active ? 700 : 400, color: active ? '#1677ff' : '#333' }}>{s.name}</Text>
              <Text style={{ fontSize: 10, color: '#999' }}>{s.gender}</Text>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Voice Settings section (reused across tabs) ───────────────────────────────
function VoiceSettings({ draft, setDraft, gender, setGender }: { draft: AgentDraft; setDraft: (d: AgentDraft) => void; gender: string; setGender: (g: string) => void }) {
  const set = <K extends keyof AgentDraft>(k: K, v: AgentDraft[K]) => setDraft({ ...draft, [k]: v });

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 12, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>⚙️ General Settings</Text>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div>
          <Text strong style={{ display: 'block', marginBottom: 6 }}>Agent Language</Text>
          <Select value={draft.language} onChange={(v) => setDraft({ ...draft, language: v, ttsLanguage: v })} options={LANGUAGES} style={{ width: '100%' }} />
        </div>
        <div>
          <Text strong style={{ display: 'block', marginBottom: 6 }}>Agent Gender</Text>
          <Select value={gender} onChange={setGender} options={[{ label: 'Male', value: 'Male' }, { label: 'Female', value: 'Female' }, { label: 'All', value: 'All' }]} style={{ width: '100%' }} />
        </div>
      </div>
      <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
        <Text strong>Select Voice</Text>
        <Text type="danger">*</Text>
      </div>
      {draft.ttsProvider === 'google' ? (
        <GoogleVoicePicker selected={draft.ttsVoiceId ?? ''} onSelect={(id) => set('ttsVoiceId', id)} gender={gender} lang={draft.language} />
      ) : draft.ttsProvider === 'openai' ? (
        <OpenAIVoicePicker selected={draft.ttsVoiceId ?? ''} onSelect={(id) => set('ttsVoiceId', id)} gender={gender} />
      ) : draft.ttsProvider === 'sarvam' ? (
        <SarvamVoicePicker selected={draft.ttsVoiceId ?? ''} onSelect={(id) => set('ttsVoiceId', id)} gender={gender} model={draft.ttsModel} />
      ) : (
        <VoicePicker selected={draft.ttsVoiceId ?? ''} onSelect={(id) => set('ttsVoiceId', id)} gender={gender} />
      )}
    </div>
  );
}

// ─── Call Detail ──────────────────────────────────────────────────────────────
type TranscriptItem = { id?: string; type: string; role?: string; content?: string[] | string; created_at?: number };

function CallDetail({ call, draft, onBack }: { call: AgentCall; draft: AgentDraft; onBack: () => void }) {
  const chatHistory = call.transcript as { items?: TranscriptItem[] } | null;
  const messages = (chatHistory?.items ?? []).filter((i) => i.type === 'message' && i.role);

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1677ff', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
        ← Back to calls
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ border: '1px solid #f0f0f0', borderRadius: 10, padding: '16px 20px' }}>
          <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>Call Details</Text>
          {([
            ['Date', new Date(call.createdAt).toLocaleString()],
            ['Duration', call.durationSeconds ? `${Math.floor(call.durationSeconds / 60)}m ${call.durationSeconds % 60}s` : '—'],
            ['Type', call.callType],
            ['Status', call.status],
            ['From', call.fromNumber ?? '—'],
            ['To', call.toNumber ?? '—'],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
              <Text style={{ fontSize: 12 }}>{value}</Text>
            </div>
          ))}
        </div>

        <div style={{ border: '1px solid #f0f0f0', borderRadius: 10, padding: '16px 20px' }}>
          <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>Models Used</Text>
          {([
            ['STT', `${draft.sttProvider} / ${draft.sttModel}`],
            ['LLM', `${draft.llmProvider} / ${draft.llmModel}`],
            ['TTS', `${draft.ttsProvider} / ${draft.ttsModel}`],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
              <Text style={{ fontSize: 12 }}>{value}</Text>
            </div>
          ))}
        </div>
      </div>

      {call.summary && (
        <div style={{ border: '1px solid #f0f0f0', borderRadius: 10, padding: '16px 20px', marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Call Summary</Text>
          <Text style={{ fontSize: 13, lineHeight: 1.6, color: '#444' }}>{call.summary}</Text>
        </div>
      )}

      <div style={{ border: '1px solid #f0f0f0', borderRadius: 10, padding: '16px 20px' }}>
        <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>Transcript</Text>
        {messages.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12 }}>No transcript available for this call.</Text>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
            {messages.map((msg, i) => {
              const isAgent = msg.role === 'assistant';
              const text = Array.isArray(msg.content) ? (msg.content as string[]).join(' ') : String(msg.content ?? '');
              if (!text.trim()) return null;
              return (
                <div key={msg.id ?? i} style={{ display: 'flex', justifyContent: isAgent ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '75%', padding: '9px 14px', fontSize: 13, lineHeight: 1.55, borderRadius: isAgent ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: isAgent ? '#e6f4ff' : '#f5f5f5', color: '#333' }}>
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

// ─── Calls Tab ────────────────────────────────────────────────────────────────
function CallsTab({ agentId, draft }: { agentId: string; draft: AgentDraft }) {
  const [calls, setCalls] = React.useState<AgentCall[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<AgentCall | null>(null);

  const fetchCalls = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiCall('GET', `/api/doctor/voice-agents/${agentId}/calls`);
      setCalls(res.data ?? res ?? []);
    } finally { setLoading(false); }
  }, [agentId]);

  useEffect(() => { void fetchCalls(); }, [fetchCalls]);

  if (selected) return <CallDetail call={selected} draft={draft} onBack={() => setSelected(null)} />;

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>;

  if (calls.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📞</div>
        <Text type="secondary">No calls yet. Calls will appear here after conversations with your agent.</Text>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button size="small" icon={<ReloadOutlined />} onClick={() => void fetchCalls()}>Refresh</Button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {calls.map((call) => (
          <div key={call.id}
            onClick={() => setSelected(call)}
            style={{ border: '1px solid #f0f0f0', borderRadius: 10, padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'box-shadow 0.15s' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
          >
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f0f7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <PhoneOutlined style={{ color: '#1677ff' }} />
              </div>
              <div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                  <Tag color={call.callType === 'inbound' ? 'blue' : 'purple'} style={{ borderRadius: 20, margin: 0 }}>{call.callType}</Tag>
                  <Tag color={call.status === 'completed' ? 'success' : call.status === 'failed' ? 'error' : 'processing'} style={{ borderRadius: 20, margin: 0 }}>{call.status}</Tag>
                  {call.bookingCreated && <Tag color="green" style={{ borderRadius: 20, margin: 0 }}><CheckCircleOutlined /> Booked</Tag>}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {call.fromNumber ? `From ${call.fromNumber}` : 'Web call'}
                  {call.durationSeconds ? ` · ${Math.floor(call.durationSeconds / 60)}m ${call.durationSeconds % 60}s` : ''}
                  {` · ${new Date(call.createdAt).toLocaleString()}`}
                </Text>
                {call.summary && <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 3 }}>{call.summary.slice(0, 80)}{call.summary.length > 80 ? '...' : ''}</Text>}
              </div>
            </div>
            <Text type="secondary" style={{ fontSize: 13, flexShrink: 0 }}>View →</Text>
          </div>
        ))}
      </div>
    </div>
  );
}

function inferGenderFromVoiceId(voiceId: string | undefined): string {
  if (!voiceId) return 'Male';
  return VOICES.find((v) => v.id === voiceId)?.gender
    ?? OPENAI_VOICES.find((v) => v.id === voiceId)?.gender
    ?? GOOGLE_VOICES.find((v) => v.id === voiceId)?.gender
    ?? 'Male';
}

// ─── Agent Config Form ────────────────────────────────────────────────────────
function AgentConfigForm({ draft, setDraft }: { draft: AgentDraft; setDraft: (d: AgentDraft) => void }) {
  const [tab, setTab] = useState<'basic' | 'stt' | 'llm' | 'tts'>('basic');
  const [gender, setGender] = useState(() => inferGenderFromVoiceId(draft.ttsVoiceId));
  const set = <K extends keyof AgentDraft>(k: K, v: AgentDraft[K]) => setDraft({ ...draft, [k]: v });

  // Sync gender when the draft loads from the API (ttsVoiceId changes from default to saved value)
  const prevVoiceIdRef = React.useRef(draft.ttsVoiceId);
  useEffect(() => {
    if (draft.ttsVoiceId && draft.ttsVoiceId !== prevVoiceIdRef.current) {
      prevVoiceIdRef.current = draft.ttsVoiceId;
      setGender(inferGenderFromVoiceId(draft.ttsVoiceId));
    }
  }, [draft.ttsVoiceId]);
  const setVs = (k: string, v: number | boolean) => setDraft({ ...draft, ttsVoiceSettings: { ...(draft.ttsVoiceSettings ?? {}), [k]: v } });
  const vs = draft.ttsVoiceSettings ?? {};

  const tabs = [
    { key: 'basic', label: 'ⓘ Basic' },
    { key: 'stt',   label: '🎙 STT'  },
    { key: 'llm',   label: '🌐 LLM'  },
    { key: 'tts',   label: '🔊 TTS'  },
  ] as const;

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, background: '#f5f5f5', borderRadius: 10, padding: 4, width: 'fit-content', marginBottom: 28 }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '7px 20px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.key ? 700 : 500, background: tab === t.key ? '#fff' : 'transparent', color: tab === t.key ? '#1677ff' : '#888', boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* BASIC */}
      {tab === 'basic' && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Text strong>Welcome Message</Text></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Allow interruptions</Text>
                <Switch checked={draft.welcomeAllowInterruptions} onChange={(v) => set('welcomeAllowInterruptions', v)} style={{ background: draft.welcomeAllowInterruptions ? '#22c55e' : '#d9d9d9' }} />
              </div>
            </div>
            <Input value={draft.welcomeMessage ?? ''} onChange={(e) => set('welcomeMessage', e.target.value)} placeholder="e.g. Hello! Thank you for calling. I'm Maya, your virtual assistant. How can I help you today?" />
          </div>

          {/* Tools section */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text strong>Add Tool</Text>
              <Button size="small" icon={<span>🔧</span>}>Add Tool</Button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, color: '#444' }}>
                <span>🔧</span> End Conversation
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, color: '#444' }}>
                <span>🔧</span> Transfer to number
              </div>
            </div>
          </div>

          {/* Prompt */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Text strong>Prompt</Text><Text type="danger">*</Text></div>
              <Text type="secondary" style={{ fontSize: 12 }}>Type {'{{'}  to add variables</Text>
            </div>
            <TextArea rows={8} value={draft.prompt ?? ''} onChange={(e) => set('prompt', e.target.value)} placeholder="Enter the agent's prompt..." style={{ fontSize: 13, fontFamily: 'monospace' }} />
          </div>

          {/* Interruption Settings */}
          <div style={{ border: '1px solid #f0f0f0', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <Text strong style={{ fontSize: 14 }}>Allow Interruptions</Text>
                <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>Let callers interrupt the AI while it&apos;s speaking</div>
              </div>
              <Switch checked={draft.allowInterruptions} onChange={(v) => set('allowInterruptions', v)} style={{ background: draft.allowInterruptions ? '#22c55e' : '#d9d9d9' }} />
            </div>
            {draft.allowInterruptions && (
              <>
                <SettingSlider
                  label="Min Interruption Duration"
                  description="How long the caller must speak (in seconds) before the AI stops. Lower = more sensitive."
                  min={0.1} max={2.0} step={0.1}
                  value={draft.minInterruptionDuration}
                  onChange={(v) => set('minInterruptionDuration', v)}
                />
                <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: '14px 18px' }}>
                  <Text strong style={{ fontSize: 14 }}>Min Interruption Words</Text>
                  <div style={{ color: '#888', fontSize: 12, marginTop: 2, marginBottom: 10 }}>How many words the caller must say to trigger an interruption</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => set('minInterruptionWords', n)}
                        style={{ width: 40, height: 36, borderRadius: 8, border: `2px solid ${draft.minInterruptionWords === n ? '#1677ff' : '#e5e7eb'}`, background: draft.minInterruptionWords === n ? '#e6f4ff' : '#fafafa', color: draft.minInterruptionWords === n ? '#1677ff' : '#555', fontWeight: draft.minInterruptionWords === n ? 700 : 400, cursor: 'pointer', fontSize: 14, transition: 'all 0.15s' }}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      )}

      {/* STT */}
      {tab === 'stt' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            <div>
              <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Text strong>Provider</Text><Text type="danger">*</Text></div>
              <Select value={draft.sttProvider} onChange={(v) => setDraft({ ...draft, sttProvider: v, sttModel: (STT_MODELS[v] ?? [])[0]?.value ?? '' })} style={{ width: '100%' }}
                options={[{ label: 'Deepgram', value: 'deepgram' }, { label: 'ElevenLabs', value: 'elevenlabs' }, { label: 'Sarvam', value: 'sarvam' }]} />
            </div>
            <div>
              <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Text strong>Models</Text><Text type="danger">*</Text></div>
              <Select value={draft.sttModel} onChange={(v) => set('sttModel', v)} style={{ width: '100%' }} options={STT_MODELS[draft.sttProvider] ?? STT_MODELS['deepgram']} />
            </div>
          </div>
        </div>
      )}

      {/* LLM */}
      {tab === 'llm' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Text strong>Provider</Text><Text type="danger">*</Text></div>
              <Select value={draft.llmProvider} onChange={(v) => setDraft({ ...draft, llmProvider: v, llmModel: (LLM_MODELS[v] ?? [])[0]?.value ?? '' })} style={{ width: '100%' }}
                options={['openai', 'anthropic'].map((p) => ({ label: p.charAt(0).toUpperCase() + p.slice(1), value: p }))} />
            </div>
            <div>
              <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Text strong>Models</Text><Text type="danger">*</Text></div>
              <Select value={draft.llmModel} onChange={(v) => set('llmModel', v)} style={{ width: '100%' }} options={LLM_MODELS[draft.llmProvider] ?? LLM_MODELS['openai']} />
            </div>
          </div>
          <SettingSlider label="Temperature" description="Control the creativity and randomness of the responses generated by the LLM." min={0} max={2} step={0.01} value={draft.llmTemperature} onChange={(v) => set('llmTemperature', v)} />
        </div>
      )}

      {/* TTS */}
      {tab === 'tts' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Text strong>Provider</Text><Text type="danger">*</Text></div>
              <Select value={draft.ttsProvider} onChange={(v) => setDraft({ ...draft, ttsProvider: v, ttsModel: (TTS_MODELS[v] ?? [])[0]?.value ?? '', ttsVoiceId: v === 'sarvam' ? 'shubh' : '' })} style={{ width: '100%' }}
                options={[{ label: 'ElevenLabs', value: 'elevenlabs' }, { label: 'Google TTS', value: 'google' }, { label: 'OpenAI', value: 'openai' }, { label: 'Sarvam', value: 'sarvam' }]} />
            </div>
            <div>
              <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Text strong>Models</Text><Text type="danger">*</Text></div>
              <Select value={draft.ttsModel} onChange={(v) => set('ttsModel', v)} style={{ width: '100%' }} options={TTS_MODELS[draft.ttsProvider] ?? TTS_MODELS['elevenlabs']} />
            </div>
          </div>
          <SettingSlider label="Stability" description="Voice tone consistency: lower values are more expressive/varied; higher values are more steady/monotone" min={0} max={1} step={0.01} value={Number(vs.stability) || 0.5} onChange={(v) => setVs('stability', v)} />
          <SettingSlider label="Similarity boost" description="How closely speech matches the original voice identity." min={0} max={1} step={0.01} value={Number(vs.similarity_boost) || 0.75} onChange={(v) => setVs('similarity_boost', v)} />
          <SettingSlider label="Style" description="Keep emotional style exaggeration at 0 for agents to avoid an unpredictable tone." min={0} max={1} step={0.01} value={Number(vs.style) || 0} onChange={(v) => setVs('style', v)} />
          <SettingSlider label="Speed" description="Speaking speed: below 1.0 slows it down; above 1.0 speeds it up." min={0.25} max={4.0} step={0.05} value={Number(vs.speed) || 1.0} onChange={(v) => setVs('speed', v)} />
          <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: '14px 18px', marginBottom: 12 }}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Use speaker boost</Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>Keeps voice consistent across the conversation.</Text>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={(vs.use_speaker_boost as boolean) ?? true} onChange={(e) => setVs('use_speaker_boost', e.target.checked)} style={{ width: 15, height: 15, accentColor: '#1677ff' }} />
              <Text style={{ fontSize: 13 }}>Enable speaker boost</Text>
            </label>
          </div>
          <VoiceSettings draft={draft} setDraft={setDraft} gender={gender} setGender={setGender} />
        </div>
      )}

    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function VoiceAgentPage() {
  const router = useRouter();
  const didRestoreUrl = useRef(false);
  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [selected, setSelected] = useState<VoiceAgent | null>(null);
  const [draft, setDraft] = useState<AgentDraft>(defaultDraft());
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [newAgentName, setNewAgentName] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [outboundModal, setOutboundModal] = useState(false);
  const [outboundNumber, setOutboundNumber] = useState('');
  const [calling, setCalling] = useState(false);
  const [createDraft, setCreateDraft] = useState<AgentDraft>(defaultDraft());
  const [search, setSearch] = useState('');
  const [playgroundOpen, setPlaygroundOpen] = useState(false);

  const loadAgents = useCallback(async () => {
    try {
      const res = await apiCall('GET', '/api/doctor/voice-agents');
      setAgents(res.data ?? res ?? []);
    } catch { /* none */ }
    finally { setLoading(false); }
  }, []);

  const loadDetail = async (agent: VoiceAgent) => {
    try {
      const [detRes, verRes] = await Promise.all([
        apiCall('GET', `/api/doctor/voice-agents/${agent.id}`),
        apiCall('GET', `/api/doctor/voice-agents/${agent.id}/versions`),
      ]);
      const detail = detRes.data ?? detRes;
      if (detail.draft) {
        const d = detail.draft;
        setDraft({
          ...defaultDraft(), ...d,
          llmTemperature: Number(d.llmTemperature) || 0.3,
          minInterruptionDuration: Number(d.minInterruptionDuration) || 0.5,
          minInterruptionWords: Number(d.minInterruptionWords) || 2,
          allowInterruptions: d.allowInterruptions ?? true,
          welcomeAllowInterruptions: d.welcomeAllowInterruptions ?? true,
          ttsVoiceSettings: d.ttsVoiceSettings
            ? Object.fromEntries(Object.entries(d.ttsVoiceSettings).map(([k, v]) => [k, typeof v === 'boolean' ? v : Number(v)]))
            : defaultDraft().ttsVoiceSettings,
        });
      }
      setVersions(verRes.data ?? verRes ?? []);
    } catch { /* ignore */ }
  };

  useEffect(() => { void loadAgents(); }, []);

  // Restore edit view from URL on refresh (e.g. /doctor/voice-agent?id=xxx)
  useEffect(() => {
    if (loading || didRestoreUrl.current) return;
    didRestoreUrl.current = true;
    const agentId = new URLSearchParams(window.location.search).get('id');
    if (!agentId) return;
    const agent = agents.find((a) => a.id === agentId);
    if (agent) {
      setSelected(agent);
      setView('edit');
      void loadDetail(agent);
    }
  }, [loading, agents]);

  const openAgent = async (agent: VoiceAgent) => {
    router.push(`/doctor/voice-agent?id=${agent.id}`);
    setSelected(agent);
    setView('edit');
    await loadDetail(agent);
  };

  const handleCreate = async () => {
    if (!newAgentName.trim()) { message.error('Agent name is required'); return; }
    setSaving(true);
    try {
      const res = await apiCall('POST', '/api/doctor/voice-agents', { displayName: newAgentName.trim() });
      const { agent } = res.data ?? res;
      await apiCall('PUT', `/api/doctor/voice-agents/${agent.id}/draft`, {
        ...createDraft,
        llmProvider: createDraft.llmProvider || 'openai',
        sttProvider: createDraft.sttProvider || 'deepgram',
        ttsProvider: createDraft.ttsProvider || 'elevenlabs',
      });
      message.success('Agent created!');
      setAgents((p) => [agent, ...p]);
      setNewAgentName('');
      setCreateDraft(defaultDraft());
      setSelected(agent);
      setDraft(createDraft);
      setVersions([]);
      setView('edit');
    } catch { message.error('Failed to create agent'); }
    finally { setSaving(false); }
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await apiCall('PUT', `/api/doctor/voice-agents/${selected.id}/draft`, {
        ...draft,
        llmProvider: draft.llmProvider || 'openai',
        sttProvider: draft.sttProvider || 'deepgram',
        ttsProvider: draft.ttsProvider || 'elevenlabs',
      });
      message.success('Draft saved');
    } catch { message.error('Save failed'); }
    finally { setSaving(false); }
  };

  const handlePublish = async () => {
    if (!selected) return;
    setPublishing(true);
    try {
      await handleSave();
      await apiCall('POST', `/api/doctor/voice-agents/${selected.id}/publish`, {});
      const verRes = await apiCall('GET', `/api/doctor/voice-agents/${selected.id}/versions`);
      setVersions(verRes.data ?? verRes ?? []);
      const updatedAgents = agents.map((a) => a.id === selected.id ? { ...a, deployedVersionId: selected.id } : a);
      setAgents(updatedAgents);
      message.success('Published! Deployment in progress.');
    } catch { message.error('Publish failed'); }
    finally { setPublishing(false); }
  };

  const handleOutbound = async () => {
    if (!selected || !outboundNumber.trim()) return;
    setCalling(true);
    try {
      await apiCall('POST', `/api/doctor/voice-agents/${selected.id}/outbound-call`, { toNumber: outboundNumber.trim() });
      setOutboundModal(false); setOutboundNumber('');
      message.success('Call initiated');
    } catch { message.error('Call failed'); }
    finally { setCalling(false); }
  };

  const handleDelete = (agentId: string) => {
    Modal.confirm({
      title: 'Delete this voice agent?',
      content: 'This action cannot be undone.',
      okType: 'danger', okText: 'Delete',
      onOk: async () => {
        await apiCall('DELETE', `/api/doctor/voice-agents/${agentId}`);
        setAgents((p) => p.filter((a) => a.id !== agentId));
        if (selected?.id === agentId) { setSelected(null); setView('list'); }
        message.success('Deleted');
      },
    });
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><Spin size="large" /></div>;

  // ── AGENT LIST ──────────────────────────────────────────────────────────────
  if (view === 'list' || view === 'create') {
    const filtered = agents.filter((a) => a.displayName.toLowerCase().includes(search.toLowerCase()));

    const columns = [
      {
        title: 'Voice Agent', dataIndex: 'displayName', key: 'displayName',
        render: (name: string) => <Text strong>{name}</Text>,
      },
      {
        title: 'Agent ID / Status', key: 'status',
        render: (_: unknown, a: VoiceAgent) => (
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              <Tag color="green" style={{ borderRadius: 20 }}>Active</Tag>
              {a.deployedVersionId && <Tag color="cyan" style={{ borderRadius: 20 }}>Live</Tag>}
            </div>
            <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>{a.name.slice(0, 22)}</Text>
          </div>
        ),
      },
      { title: 'STT Model', key: 'stt', render: () => <Text type="secondary">nova-3</Text> },
      { title: 'LLM Model', key: 'llm', render: () => <Text type="secondary">gpt-4o-mini</Text> },
      { title: 'TTS Provider', key: 'tts', render: () => <Text type="secondary">elevenlabs</Text> },
      {
        title: 'Actions', key: 'actions', width: 60,
        render: (_: unknown, a: VoiceAgent) => (
          <Dropdown menu={{ items: [
            { key: 'edit',   label: 'Edit Agent',     onClick: () => void openAgent(a) },
            { key: 'call',   label: 'Outbound Call',  disabled: !a.deployedVersionId, onClick: () => { setSelected(a); setOutboundModal(true); } },
            { key: 'delete', label: 'Delete', danger: true, onClick: () => handleDelete(a.id) },
          ]}} trigger={['click']}>
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        ),
      },
    ];

    return (
      <div style={{ padding: '0 4px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <Title level={4} style={{ margin: 0 }}>Voice Agent Management</Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCreateDraft(defaultDraft()); setView('create'); }}>
            Create new Agent
          </Button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <Input prefix={<SearchOutlined style={{ color: '#ccc' }} />} placeholder="Search by agent name" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 360 }} allowClear />
        </div>

        <Table
          dataSource={filtered}
          rowKey="id"
          columns={columns}
          pagination={false}
          onRow={(a) => ({ onDoubleClick: () => void openAgent(a), style: { cursor: 'pointer' } })}
          locale={{ emptyText: (
            <div style={{ padding: '48px 0', textAlign: 'center' }}>
              <Text type="secondary">No voice agents yet. Create your first one!</Text>
            </div>
          )}}
        />

        {/* Create modal */}
        <Modal
          title="Create New Voice Agent"
          open={view === 'create'}
          onCancel={() => setView('list')}
          footer={null}
          width={860}
          destroyOnHidden
        >
          <div style={{ marginBottom: 20 }}>
            <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Text strong>Agent Display Name</Text><Text type="danger">*</Text></div>
            <Input value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} placeholder="e.g. Dr. Smith's Assistant" size="large" onPressEnter={handleCreate} />
          </div>
          <div style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: 4 }}>
            <AgentConfigForm draft={createDraft} setDraft={setCreateDraft} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
            <Button onClick={() => setView('list')}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={handleCreate} icon={<PlusOutlined />}>Create Agent</Button>
          </div>
        </Modal>

        {/* Outbound from list */}
        <Modal title="Make Outbound Call" open={outboundModal && !selected?.deployedVersionId === false && outboundModal} onCancel={() => setOutboundModal(false)} onOk={handleOutbound} confirmLoading={calling} okText="Call Now">
          <Text strong style={{ display: 'block', marginBottom: 6 }}>Patient Phone Number</Text>
          <Input prefix={<PhoneOutlined />} value={outboundNumber} onChange={(e) => setOutboundNumber(e.target.value)} placeholder="+91 9876543210" />
        </Modal>
      </div>
    );
  }

  // ── EDIT VIEW ───────────────────────────────────────────────────────────────
  const isLive = !!selected?.deployedVersionId;

  const publishMenuItems = [
    { key: 'publish', label: <span>☁️ Publish Now</span>, onClick: () => void handlePublish() },
    { key: 'history', label: <span><HistoryOutlined /> Version History</span>, onClick: () => setHistoryOpen(true) },
  ];

  return (
    <div>
      {/* Edit header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => { router.push('/doctor/voice-agent'); setView('list'); setSelected(null); }} style={{ marginTop: 2 }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Title level={4} style={{ margin: 0 }}>{selected?.displayName}</Title>
              {isLive && <Tag color="green" style={{ borderRadius: 20 }}>Live</Tag>}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>Edit your Voice Agent's configuration</Text>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {isLive && <Button icon={<PhoneOutlined />} onClick={() => setOutboundModal(true)}>Outbound Call</Button>}
          {isLive && (
            <Button
              onClick={() => setPlaygroundOpen(true)}
              style={{ background: '#1677ff', borderColor: '#1677ff', color: '#fff' }}
              icon={<span>▶</span>}
            >
              Test
            </Button>
          )}
          <Button onClick={() => void handleSave()} loading={saving}>Save Draft</Button>
          <Space.Compact>
            <Button type="primary" loading={publishing} onClick={() => void handlePublish()}>
              Publish
            </Button>
            <Dropdown menu={{ items: publishMenuItems }} placement="bottomRight">
              <Button type="primary" icon={<span style={{ fontSize: 12 }}>···</span>} style={{ paddingInline: 8 }} />
            </Dropdown>
          </Space.Compact>
          <Tooltip title="Delete agent">
            <Button danger icon={<DeleteOutlined />} onClick={() => selected && handleDelete(selected.id)} />
          </Tooltip>
        </div>
      </div>

      {/* Config form */}
      <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 12, padding: '24px 28px' }}>
        <AgentConfigForm draft={draft} setDraft={setDraft} />
      </div>

      {/* Version History Drawer */}
      <Drawer
        title={<span><HistoryOutlined /> Published history</span>}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        styles={{ wrapper: { width: 480 } }}
      >
        {versions.length === 0 ? (
          <Text type="secondary">No versions published yet.</Text>
        ) : versions.map((v) => (
          <div key={v.id} style={{ border: '1px solid #f0f0f0', borderRadius: 10, padding: '14px 18px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text strong>Version {v.version}</Text>
                {v.id === selected?.deployedVersionId && <Tag color="green">Live</Tag>}
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>Published: {new Date(v.publishedAt).toLocaleString()}</Text>
              <br /><Text type="secondary" style={{ fontSize: 12 }}>Notes: Publish</Text>
            </div>
            {v.id !== selected?.deployedVersionId && (
              <Button size="small" icon={<ReloadOutlined />} onClick={() => void apiCall('POST', `/api/doctor/voice-agents/${selected?.id}/publish`, { sourceVersionId: v.id }).then(() => message.success('Reverted'))}>
                Revert
              </Button>
            )}
          </div>
        ))}
      </Drawer>

      {/* Outbound modal */}
      <Modal title="Make Outbound Call" open={outboundModal} onCancel={() => setOutboundModal(false)} onOk={handleOutbound} confirmLoading={calling} okText="Call Now">
        <Text strong style={{ display: 'block', marginBottom: 6 }}>Patient Phone Number</Text>
        <Input prefix={<PhoneOutlined />} value={outboundNumber} onChange={(e) => setOutboundNumber(e.target.value)} placeholder="+91 9876543210" />
        <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>The agent will call this number on your behalf.</Text>
      </Modal>

      {/* Playground panel */}
      {selected && (
        <VoicePlayground
          agentId={selected.id}
          open={playgroundOpen}
          onClose={() => setPlaygroundOpen(false)}
        />
      )}
    </div>
  );
}
