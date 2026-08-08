'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Tag, Button, Typography, Spin, Empty, Modal, Divider,
  Space, message,
} from 'antd';
import {
  FileTextOutlined, EyeOutlined, FilePdfOutlined, SendOutlined, PlusOutlined,
  MedicineBoxOutlined, ExperimentOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { apiCall } from '../../../lib/api';
import type { TablePaginationConfig } from 'antd';

const { Title, Text } = Typography;

const TEAL = '#0e7490';

interface Medicine { name: string; genericName?: string; dosage: string; frequency: string; duration: string; route: string; notes?: string; }
interface Test { name: string; category?: string; instructions?: string; }
interface Prescription {
  id: string; diagnosis?: string; notes?: string;
  medicines: Medicine[]; tests: Test[];
  pdfUrl?: string; isSent: boolean; createdAt: string;
  booking?: { scheduledAt: string; patient?: { fullName?: string; phoneNumber?: string } };
}
interface DoctorProfile {
  specialty?: string;
  licenseNumber?: string;
  qualifications?: string[];
  user?: { fullName?: string };
}

function PrescriptionPad({ rx, doctor }: { rx: Prescription; doctor: DoctorProfile | null }) {
  const rawName = doctor?.user?.fullName ?? '';
  const doctorName = rawName
    ? (rawName.toLowerCase().startsWith('dr.') ? rawName : `Dr. ${rawName}`)
    : 'Doctor';
  const specialty = doctor?.specialty ?? '';
  const qualifications = (doctor?.qualifications ?? []).join(', ');
  const licenseNo = doctor?.licenseNumber ?? '';
  const patientName = rx.booking?.patient?.fullName || rx.booking?.patient?.phoneNumber || '—';
  const dateStr = new Date(rx.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' });
  const refNo = rx.id.slice(0, 8).toUpperCase();

  return (
    <div style={{ fontFamily: 'inherit' }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingBottom: 14,
        borderBottom: `3px solid ${TEAL}`,
        marginBottom: 14,
      }}>
        {/* Left: platform */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-full.png" alt="ZyroHealth" style={{ height: 26, width: 'auto', display: 'block', marginBottom: 4 }} />
            <div style={{ fontSize: 11, color: '#64748b' }}>Digital Health Platform</div>
          </div>
        </div>

        {/* Right: doctor info */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>{doctorName}</div>
          {specialty && <div style={{ fontSize: 13, color: '#374151' }}>{specialty}</div>}
          {qualifications && <div style={{ fontSize: 12, color: '#64748b' }}>{qualifications}</div>}
          {licenseNo && <div style={{ fontSize: 11, color: '#94a3b8' }}>Reg. No.: {licenseNo}</div>}
          <div style={{ marginTop: 4, width: '100%', height: 2, background: TEAL, borderRadius: 2 }} />
        </div>
      </div>

      {/* ── Patient info row ── */}
      <div style={{
        display: 'flex', gap: 0,
        border: '1px solid #e2e8f0',
        borderRadius: 8, overflow: 'hidden',
        marginBottom: 20,
      }}>
        {[
          { label: 'PATIENT', value: patientName },
          { label: 'DATE', value: dateStr },
          { label: 'REF. NO.', value: refNo },
          ...(rx.diagnosis ? [{ label: 'DIAGNOSIS', value: rx.diagnosis }] : []),
        ].map((item, i, arr) => (
          <div key={item.label} style={{
            flex: item.label === 'DIAGNOSIS' ? 2 : 1,
            padding: '8px 14px',
            borderRight: i < arr.length - 1 ? '1px solid #e2e8f0' : 'none',
            background: '#f8fafc',
          }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, letterSpacing: 0.5, marginBottom: 2 }}>{item.label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{item.value}</div>
          </div>
        ))}
        <div style={{ padding: '8px 14px', background: '#f8fafc', display: 'flex', alignItems: 'center' }}>
          <Tag color={rx.isSent ? 'green' : 'orange'} style={{ margin: 0 }}>{rx.isSent ? 'Sent' : 'Draft'}</Tag>
        </div>
      </div>

      {/* ── Rx + Medicines ── */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 32, fontWeight: 700, fontFamily: 'Georgia, serif', color: '#1e293b', lineHeight: 1 }}>℞</span>
        <Text style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>
          <MedicineBoxOutlined style={{ marginRight: 5 }} />Medicines
        </Text>
      </div>

      {rx.medicines.map((med, i) => (
        <div key={i} style={{ padding: '9px 0', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
            <Text style={{ color: '#cbd5e1', minWidth: 20, fontSize: 13 }}>{i + 1}.</Text>
            <Text strong style={{ fontSize: 14 }}>{med.name}</Text>
            {med.genericName && <Text type="secondary" style={{ fontSize: 12 }}>({med.genericName})</Text>}
          </div>
          <div style={{ marginLeft: 20, fontSize: 13, color: '#475569' }}>
            <span style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4, padding: '1px 7px', marginRight: 6 }}>{med.dosage}</span>
            <span style={{ marginRight: 6 }}>{med.frequency}</span>
            <span style={{ marginRight: 6 }}>·</span>
            <span style={{ marginRight: 6 }}>{med.duration}</span>
            <span style={{ marginRight: 6 }}>·</span>
            <span style={{ color: '#94a3b8' }}>{med.route}</span>
            {med.notes && <span style={{ color: '#94a3b8', marginLeft: 8 }}>· {med.notes}</span>}
          </div>
        </div>
      ))}

      {/* ── Lab Tests ── */}
      {rx.tests.length > 0 && (
        <>
          <Divider style={{ margin: '14px 0' }} />
          <Text style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>
            <ExperimentOutlined style={{ marginRight: 5 }} />Lab Tests
          </Text>
          {rx.tests.map((test, i) => (
            <div key={i} style={{ padding: '7px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: '#cbd5e1', minWidth: 20, fontSize: 13 }}>{i + 1}.</Text>
              <Text strong style={{ fontSize: 13 }}>{test.name}</Text>
              {test.category && <Tag style={{ fontSize: 11, background: '#f5f3ff', borderColor: '#ddd6fe', color: '#6d28d9' }}>{test.category}</Tag>}
              {test.instructions && <Text type="secondary" style={{ fontSize: 12 }}>— {test.instructions}</Text>}
            </div>
          ))}
        </>
      )}

      {/* ── Doctor Notes ── */}
      {rx.notes && (
        <>
          <Divider style={{ margin: '14px 0' }} />
          <div style={{ background: '#fffbe6', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px' }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 3 }}>Doctor&apos;s Notes</Text>
            <Text style={{ fontSize: 13 }}>{rx.notes}</Text>
          </div>
        </>
      )}

      {/* ── Signature ── */}
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ textAlign: 'center', minWidth: 180 }}>
          <div style={{
            fontFamily: "'Brush Script MT', 'Segoe Script', 'Dancing Script', cursive",
            fontSize: 28, color: '#1e293b', lineHeight: 1.2, marginBottom: 4,
          }}>
            {doctorName}
          </div>
          <div style={{ width: '100%', borderBottom: `1px solid ${TEAL}`, marginBottom: 6 }} />
          <Text style={{ fontSize: 12, color: '#64748b' }}>{doctorName}</Text>
          {specialty && <div style={{ fontSize: 11, color: '#94a3b8' }}>{specialty}</div>}
        </div>
      </div>
    </div>
  );
}

export default function DoctorPrescriptionsPage() {
  const router = useRouter();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [preview, setPreview] = useState<Prescription | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);

  useEffect(() => {
    apiCall('GET', '/api/doctor/profile').then((res) => setDoctor(res.data ?? res)).catch(() => {});
  }, []);

  const openPdf = async (id: string) => {
    try {
      const res = await apiCall('GET', `/api/prescriptions/${id}/pdf`);
      const url: string = res.data?.url ?? res.url;
      window.open(url, '_blank', 'noreferrer');
    } catch {
      message.error('Could not generate download link');
    }
  };

  const fetchPrescriptions = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await apiCall('GET', `/api/prescriptions?page=${page}&limit=20`);
      const payload = res.data ?? res;
      setPrescriptions(payload.data || []);
      setPagination((prev) => ({ ...prev, current: page, total: payload.total || 0 }));
    } catch { setPrescriptions([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPrescriptions(1); }, [fetchPrescriptions]);

  const handleSend = async (id: string) => {
    setSending(id);
    try {
      await apiCall('POST', `/api/prescriptions/${id}/send`, {});
      message.success('Prescription sent to patient');
      fetchPrescriptions(pagination.current);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) message.error(err.response?.data?.message || 'Failed to send');
    } finally { setSending(null); }
  };

  const patientName = (rx: Prescription) =>
    rx.booking?.patient?.fullName || rx.booking?.patient?.phoneNumber || 'Patient';

  const columns = [
    {
      title: 'Patient', key: 'patient',
      render: (_: unknown, rx: Prescription) => <Text strong>{patientName(rx)}</Text>,
    },
    {
      title: 'Diagnosis', dataIndex: 'diagnosis', key: 'diagnosis',
      render: (v?: string) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Medicines', key: 'medicines',
      render: (_: unknown, rx: Prescription) => (
        <Space size={4} wrap>
          {rx.medicines.slice(0, 3).map((m, i) => <Tag key={i} style={{ fontSize: 11 }}>{m.name}</Tag>)}
          {rx.medicines.length > 3 && <Tag style={{ fontSize: 11 }}>+{rx.medicines.length - 3} more</Tag>}
        </Space>
      ),
    },
    {
      title: 'Tests', key: 'tests',
      render: (_: unknown, rx: Prescription) => rx.tests.length > 0
        ? <Tag style={{ fontSize: 11 }}>{rx.tests.length} test{rx.tests.length > 1 ? 's' : ''}</Tag>
        : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    },
    {
      title: 'Date', dataIndex: 'createdAt', key: 'createdAt',
      render: (v: string) => new Date(v).toLocaleDateString('en-IN', { dateStyle: 'medium' }),
    },
    {
      title: 'Status', key: 'status',
      render: (_: unknown, rx: Prescription) => (
        <Tag color={rx.isSent ? 'green' : 'orange'}>{rx.isSent ? 'Sent' : 'Draft'}</Tag>
      ),
    },
    {
      title: 'Actions', key: 'actions',
      render: (_: unknown, rx: Prescription) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setPreview(rx)}>View</Button>
          {rx.pdfUrl && (
            <Button size="small" icon={<FilePdfOutlined />} onClick={() => void openPdf(rx.id)}>PDF</Button>
          )}
          {!rx.isSent && (
            <Button size="small" type="primary" icon={<SendOutlined />}
              loading={sending === rx.id} onClick={() => void handleSend(rx.id)}>
              Send
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}><FileTextOutlined /> Prescriptions</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push('/doctor/prescriptions/create')}>
          New Prescription
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : prescriptions.length === 0 ? (
        <Empty description="No prescriptions yet" image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <Button type="primary" onClick={() => router.push('/doctor/prescriptions/create')}>Create First Prescription</Button>
        </Empty>
      ) : (
        <Table
          columns={columns}
          dataSource={prescriptions.map((rx) => ({ ...rx, key: rx.id }))}
          pagination={{ current: pagination.current, pageSize: pagination.pageSize, total: pagination.total, showSizeChanger: false, showTotal: (t) => `${t} prescriptions` }}
          onChange={(p: TablePaginationConfig) => fetchPrescriptions(p.current || 1)}
          bordered size="middle"
        />
      )}

      <Modal
        title={<span><FileTextOutlined style={{ marginRight: 8 }} />Prescription</span>}
        open={!!preview}
        onCancel={() => setPreview(null)}
        width={680}
        destroyOnHidden
        footer={
          preview ? (
            <Space>
              {preview.pdfUrl && <Button icon={<FilePdfOutlined />} onClick={() => void openPdf(preview.id)}>Download PDF</Button>}
              {!preview.isSent && (
                <Button type="primary" icon={<SendOutlined />} loading={sending === preview.id}
                  onClick={() => { void handleSend(preview.id); setPreview(null); }}>
                  Send to Patient
                </Button>
              )}
              <Button onClick={() => setPreview(null)}>Close</Button>
            </Space>
          ) : null
        }
      >
        {preview && <PrescriptionPad rx={preview} doctor={doctor} />}
      </Modal>
    </div>
  );
}
