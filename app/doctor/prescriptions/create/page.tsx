'use client';

import React, { useEffect, useState, Suspense } from 'react';
import {
  Input, Button, Typography, Select, Tag, Divider, Empty, Spin,
  message, Modal, Space,
} from 'antd';
import {
  SearchOutlined, PlusOutlined, DeleteOutlined, MedicineBoxOutlined,
  ExperimentOutlined, FileTextOutlined, ArrowLeftOutlined, SendOutlined, EyeOutlined,
  PlusSquareOutlined,
} from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { apiCall } from '../../../../lib/api';

const { Title, Text } = Typography;
const { Option } = Select;

const ROUTES = ['oral', 'topical', 'intravenous', 'intramuscular', 'subcutaneous', 'inhaled', 'sublingual'];
const FREQUENCIES = ['once daily', 'twice daily', 'thrice daily', 'every 4 hours', 'every 6 hours', 'every 8 hours', 'every 12 hours', 'as needed', 'at bedtime'];

interface LibMedicine {
  id: string;
  name: string;
  genericName?: string;
  category?: string;
  defaultDosage?: string;
  defaultFrequency?: string;
  defaultDuration?: string;
  defaultRoute?: string;
  notes?: string;
}

interface LibTest {
  id: string;
  name: string;
  category?: string;
  description?: string;
  defaultInstructions?: string;
}

interface DraftMedicine {
  _key: string;
  name: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  notes?: string;
}

interface DraftTest {
  _key: string;
  name: string;
  category?: string;
  instructions?: string;
}

interface Booking {
  id: string;
  scheduledAt: string;
  patient?: { fullName?: string; phoneNumber?: string };
}

interface DoctorProfile {
  specialty?: string;
  licenseNumber?: string;
  qualifications?: string[];
  user?: { fullName?: string };
}

function PrescriptionBuilder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingIdFromUrl = searchParams.get('bookingId');

  const [medicines, setMedicines] = useState<LibMedicine[]>([]);
  const [tests, setTests] = useState<LibTest[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingLib, setLoadingLib] = useState(true);
  const [libSearch, setLibSearch] = useState('');
  const [libTab, setLibTab] = useState<'medicines' | 'tests'>('medicines');

  // Draft state
  const [selectedBookingId, setSelectedBookingId] = useState<string>(bookingIdFromUrl ?? '');
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [draftMedicines, setDraftMedicines] = useState<DraftMedicine[]>([]);
  const [draftTests, setDraftTests] = useState<DraftTest[]>([]);
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);

  useEffect(() => {
    apiCall('GET', '/api/doctor/profile').then((res) => setDoctor(res.data ?? res)).catch(() => {});
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoadingLib(true);
      try {
        const [medRes, testRes, bookingRes] = await Promise.all([
          apiCall('GET', '/api/doctor/medicines'),
          apiCall('GET', '/api/doctor/tests'),
          apiCall('GET', '/api/bookings?limit=100'),
        ]);
        setMedicines(medRes.data || medRes || []);
        setTests(testRes.data || testRes || []);
        const all: Booking[] = bookingRes.data || bookingRes || [];
        setBookings(all.filter((b: Booking & { status?: string }) => ['paid', 'active', 'confirmed'].includes(b.status ?? '')));
        if (bookingIdFromUrl && !selectedBookingId) setSelectedBookingId(bookingIdFromUrl);
      } catch { /* silent */ }
      finally { setLoadingLib(false); }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingIdFromUrl]);

  const filteredMeds = medicines.filter((m) =>
    !libSearch || m.name.toLowerCase().includes(libSearch.toLowerCase()) ||
    m.genericName?.toLowerCase().includes(libSearch.toLowerCase()) ||
    m.category?.toLowerCase().includes(libSearch.toLowerCase()),
  );

  const filteredTests = tests.filter((t) =>
    !libSearch || t.name.toLowerCase().includes(libSearch.toLowerCase()) ||
    t.category?.toLowerCase().includes(libSearch.toLowerCase()),
  );

  const addMedicine = (med: LibMedicine) => {
    const key = `${med.id}-${Date.now()}`;
    setDraftMedicines((prev) => [
      ...prev,
      {
        _key: key,
        name: med.name,
        genericName: med.genericName ?? undefined,
        dosage: med.defaultDosage ?? '',
        frequency: med.defaultFrequency ?? 'once daily',
        duration: med.defaultDuration ?? '',
        route: med.defaultRoute ?? 'oral',
        notes: med.notes ?? undefined,
      },
    ]);
  };

  const addTest = (test: LibTest) => {
    const key = `${test.id}-${Date.now()}`;
    setDraftTests((prev) => [
      ...prev,
      { _key: key, name: test.name, category: test.category ?? undefined, instructions: test.defaultInstructions ?? undefined },
    ]);
  };

  const updateMedicine = (key: string, field: keyof DraftMedicine, value: string) => {
    setDraftMedicines((prev) => prev.map((m) => m._key === key ? { ...m, [field]: value } : m));
  };

  const removeMedicine = (key: string) => setDraftMedicines((prev) => prev.filter((m) => m._key !== key));
  const removeTest = (key: string) => setDraftTests((prev) => prev.filter((t) => t._key !== key));

  const validate = () => {
    if (!selectedBookingId) { message.warning('Select an appointment first'); return false; }
    if (draftMedicines.length === 0) { message.warning('Add at least one medicine'); return false; }
    const missing = draftMedicines.find((m) => !m.dosage || !m.frequency || !m.duration || !m.route);
    if (missing) { message.warning(`Fill in all details for "${missing.name}"`); return false; }
    return true;
  };

  const handlePreview = () => { if (validate()) setShowPreview(true); };

  const handleGenerate = async (allergyOverride = false) => {
    setGenerating(true);
    setShowPreview(false);
    try {
      await apiCall('POST', '/api/prescriptions', {
        bookingId: selectedBookingId,
        diagnosis: diagnosis.trim() || undefined,
        notes: notes.trim() || undefined,
        medicines: draftMedicines.map(({ _key: _k, ...m }) => m),
        tests: draftTests.map(({ _key: _k, ...t }) => ({ name: t.name, category: t.category, instructions: t.instructions })),
        confirmedAllergyOverride: allergyOverride,
      });
      message.success('Prescription generated successfully!');
      router.push('/doctor/prescriptions');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.message ?? '';
        if (msg.includes('Allergy')) {
          Modal.confirm({
            title: 'Allergy Conflict Detected',
            content: msg + '\n\nOverride and prescribe anyway?',
            okText: 'Override & Generate',
            okType: 'danger',
            onOk: () => void handleGenerate(true),
          });
        } else {
          message.error(msg || 'Failed to generate prescription');
        }
      }
    } finally { setGenerating(false); }
  };

  const patientLabel = (b: Booking) => {
    const name = b.patient?.fullName || b.patient?.phoneNumber || 'Patient';
    return `${name} — ${new Date(b.scheduledAt).toLocaleString()}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()} />
        <Title level={4} style={{ margin: 0 }}>
          <FileTextOutlined /> Prescription Builder
        </Title>
      </div>

      <div style={{ display: 'flex', gap: 16, flex: 1, overflow: 'hidden' }}>

        {/* ── Left panel: Library ── */}
        <div style={{
          width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column',
          background: '#fff', borderRadius: 12, border: '1px solid #f0f0f0',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid #f0f0f0' }}>
            <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>My Library</Text>
            <Input
              prefix={<SearchOutlined style={{ color: '#bbb' }} />}
              placeholder="Search..."
              value={libSearch}
              onChange={(e) => setLibSearch(e.target.value)}
              allowClear
              size="small"
              style={{ borderRadius: 6 }}
            />
            {/* Tab toggle */}
            <div style={{ display: 'flex', marginTop: 8, borderRadius: 6, overflow: 'hidden', border: '1px solid #e8e8e8' }}>
              {(['medicines', 'tests'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setLibTab(tab)}
                  style={{
                    flex: 1, padding: '4px 0', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                    background: libTab === tab ? '#1677ff' : '#fff',
                    color: libTab === tab ? '#fff' : '#555',
                    transition: 'all 0.15s',
                  }}
                >
                  {tab === 'medicines' ? <><MedicineBoxOutlined /> Medicines</> : <><ExperimentOutlined /> Tests</>}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
            {loadingLib ? (
              <div style={{ textAlign: 'center', padding: 20 }}><Spin size="small" /></div>
            ) : libTab === 'medicines' ? (
              filteredMeds.length === 0 ? (
                <Empty description={<span style={{ fontSize: 12 }}>No medicines yet.<br />Go to My Library to add.</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '20px 0' }} />
              ) : filteredMeds.map((med) => (
                <div
                  key={med.id}
                  onClick={() => addMedicine(med)}
                  style={{
                    padding: '8px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 4,
                    border: '1px solid #f0f0f0', background: '#fafafa',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#e6f4ff'; (e.currentTarget as HTMLDivElement).style.borderColor = '#1677ff'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#fafafa'; (e.currentTarget as HTMLDivElement).style.borderColor = '#f0f0f0'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <Text strong style={{ fontSize: 13, display: 'block' }}>{med.name}</Text>
                      {med.genericName && <Text type="secondary" style={{ fontSize: 11 }}>{med.genericName}</Text>}
                      {med.defaultDosage && <Text style={{ fontSize: 11, color: '#888', display: 'block' }}>{med.defaultDosage} · {med.defaultFrequency}</Text>}
                    </div>
                    <PlusOutlined style={{ color: '#1677ff', fontSize: 14, marginLeft: 6, flexShrink: 0 }} />
                  </div>
                  {med.category && <Tag style={{ marginTop: 4, fontSize: 10 }}>{med.category}</Tag>}
                </div>
              ))
            ) : (
              filteredTests.length === 0 ? (
                <Empty description={<span style={{ fontSize: 12 }}>No tests yet.<br />Go to My Library to add.</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '20px 0' }} />
              ) : filteredTests.map((test) => (
                <div
                  key={test.id}
                  onClick={() => addTest(test)}
                  style={{
                    padding: '8px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 4,
                    border: '1px solid #f0f0f0', background: '#fafafa',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#f0f9ff'; (e.currentTarget as HTMLDivElement).style.borderColor = '#40a9ff'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#fafafa'; (e.currentTarget as HTMLDivElement).style.borderColor = '#f0f0f0'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <Text strong style={{ fontSize: 13 }}>{test.name}</Text>
                      {test.category && <Tag color="blue" style={{ marginLeft: 6, fontSize: 10 }}>{test.category}</Tag>}
                    </div>
                    <PlusOutlined style={{ color: '#40a9ff', fontSize: 14, flexShrink: 0 }} />
                  </div>
                  {test.defaultInstructions && <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>{test.defaultInstructions}</Text>}
                </div>
              ))
            )}
          </div>

          <div style={{ padding: 10, borderTop: '1px solid #f0f0f0' }}>
            <Button block size="small" onClick={() => router.push('/doctor/library')}>
              Manage Library
            </Button>
          </div>
        </div>

        {/* ── Right panel: Prescription Draft ── */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', background: '#fff',
          borderRadius: 12, border: '1px solid #f0f0f0', overflow: 'hidden',
        }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

            {/* Appointment selector */}
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>Appointment</Text>
              <Select
                style={{ width: '100%' }}
                placeholder="Select patient appointment..."
                value={selectedBookingId || undefined}
                onChange={setSelectedBookingId}
                disabled={!!bookingIdFromUrl}
                showSearch
                filterOption={(input, option) =>
                  String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                }
              >
                {bookings.map((b) => (
                  <Option key={b.id} value={b.id}>{patientLabel(b)}</Option>
                ))}
              </Select>
            </div>

            {/* Diagnosis */}
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>Diagnosis</Text>
              <Input
                placeholder="Primary diagnosis..."
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                style={{ borderRadius: 8 }}
              />
            </div>

            <Divider style={{ margin: '12px 0' }}>
              <MedicineBoxOutlined style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 13, fontWeight: 600 }}>Medicines ({draftMedicines.length})</Text>
            </Divider>

            {draftMedicines.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#bbb' }}>
                <MedicineBoxOutlined style={{ fontSize: 28, display: 'block', marginBottom: 6 }} />
                <Text type="secondary" style={{ fontSize: 13 }}>Click a medicine from your library to add it here</Text>
              </div>
            ) : draftMedicines.map((med) => (
              <div key={med._key} style={{
                border: '1px solid #e8e8e8', borderRadius: 10, padding: 14,
                marginBottom: 10, background: '#fafeff',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <Text strong style={{ fontSize: 14 }}>{med.name}</Text>
                    {med.genericName && <Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>({med.genericName})</Text>}
                  </div>
                  <Button
                    type="text" danger size="small" icon={<DeleteOutlined />}
                    onClick={() => removeMedicine(med._key)}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                  <div>
                    <Text style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 2 }}>Dosage *</Text>
                    <Input
                      size="small"
                      placeholder="e.g. 500mg"
                      value={med.dosage}
                      onChange={(e) => updateMedicine(med._key, 'dosage', e.target.value)}
                      style={{ borderRadius: 6 }}
                      status={!med.dosage ? 'error' : undefined}
                    />
                  </div>
                  <div>
                    <Text style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 2 }}>Frequency *</Text>
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      value={med.frequency || undefined}
                      placeholder="Select"
                      onChange={(v) => updateMedicine(med._key, 'frequency', v)}
                      status={!med.frequency ? 'error' : undefined}
                    >
                      {FREQUENCIES.map((f) => <Option key={f} value={f}>{f}</Option>)}
                    </Select>
                  </div>
                  <div>
                    <Text style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 2 }}>Duration *</Text>
                    <Input
                      size="small"
                      placeholder="e.g. 5 days"
                      value={med.duration}
                      onChange={(e) => updateMedicine(med._key, 'duration', e.target.value)}
                      style={{ borderRadius: 6 }}
                      status={!med.duration ? 'error' : undefined}
                    />
                  </div>
                  <div>
                    <Text style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 2 }}>Route *</Text>
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      value={med.route || undefined}
                      placeholder="Select"
                      onChange={(v) => updateMedicine(med._key, 'route', v)}
                      status={!med.route ? 'error' : undefined}
                    >
                      {ROUTES.map((r) => <Option key={r} value={r}>{r}</Option>)}
                    </Select>
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 2 }}>Notes</Text>
                  <Input
                    size="small"
                    placeholder="e.g. Take after meals"
                    value={med.notes ?? ''}
                    onChange={(e) => updateMedicine(med._key, 'notes', e.target.value)}
                    style={{ borderRadius: 6 }}
                  />
                </div>
              </div>
            ))}

            <Divider style={{ margin: '12px 0' }}>
              <ExperimentOutlined style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 13, fontWeight: 600 }}>Lab Tests ({draftTests.length})</Text>
            </Divider>

            {draftTests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: '#bbb' }}>
                <ExperimentOutlined style={{ fontSize: 24, display: 'block', marginBottom: 4 }} />
                <Text type="secondary" style={{ fontSize: 13 }}>Click a test from your library to add it</Text>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {draftTests.map((test) => (
                  <div key={test._key} style={{
                    border: '1px solid #e8e8e8', borderRadius: 8, padding: '8px 12px',
                    background: '#f0f9ff', display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <ExperimentOutlined style={{ color: '#40a9ff' }} />
                    <div>
                      <Text strong style={{ fontSize: 13 }}>{test.name}</Text>
                      {test.category && <Tag color="blue" style={{ marginLeft: 4, fontSize: 10 }}>{test.category}</Tag>}
                      {test.instructions && (
                        <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{test.instructions}</Text>
                      )}
                    </div>
                    <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeTest(test._key)} />
                  </div>
                ))}
              </div>
            )}

            {/* Doctor notes */}
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>Doctor&apos;s Notes</Text>
              <Input.TextArea
                rows={3}
                placeholder="Follow-up instructions, additional advice..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ borderRadius: 8 }}
              />
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '12px 20px', borderTop: '1px solid #f0f0f0',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexShrink: 0, background: '#fff',
          }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {draftMedicines.length} medicine{draftMedicines.length !== 1 ? 's' : ''} · {draftTests.length} test{draftTests.length !== 1 ? 's' : ''}
            </Text>
            <Button
              type="primary"
              size="large"
              icon={<EyeOutlined />}
              loading={generating}
              disabled={!selectedBookingId || draftMedicines.length === 0}
              onClick={handlePreview}
              style={{ borderRadius: 8, minWidth: 180 }}
            >
              Preview &amp; Generate
            </Button>
          </div>
        </div>
      </div>

      {/* ── Preview Modal ── */}
      <Modal
        title={<span><EyeOutlined style={{ marginRight: 8 }} />Prescription Preview</span>}
        open={showPreview}
        onCancel={() => setShowPreview(false)}
        width={680}
        destroyOnHidden
        footer={
          <Space>
            <Button onClick={() => setShowPreview(false)}>Back to Edit</Button>
            <Button type="primary" icon={<SendOutlined />} loading={generating} onClick={() => void handleGenerate()}>
              Confirm &amp; Generate
            </Button>
          </Space>
        }
      >
        {(() => {
          const TEAL = '#0e7490';
          const rawName = doctor?.user?.fullName ?? '';
          const doctorName = rawName
            ? (rawName.toLowerCase().startsWith('dr.') ? rawName : `Dr. ${rawName}`)
            : 'Doctor';
          const selectedBooking = bookings.find((b) => b.id === selectedBookingId);
          const patientName = selectedBooking?.patient?.fullName || selectedBooking?.patient?.phoneNumber || '—';

          return (
            <div>
              {/* Header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                paddingBottom: 14, borderBottom: `3px solid ${TEAL}`, marginBottom: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%', background: TEAL,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <PlusSquareOutlined style={{ color: '#fff', fontSize: 20 }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>HealthPlus</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Digital Health Platform</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>{doctorName}</div>
                  {doctor?.specialty && <div style={{ fontSize: 13, color: '#374151' }}>{doctor.specialty}</div>}
                  {!!doctor?.qualifications?.length && <div style={{ fontSize: 12, color: '#64748b' }}>{doctor.qualifications.join(', ')}</div>}
                  {doctor?.licenseNumber && <div style={{ fontSize: 11, color: '#94a3b8' }}>Reg. No.: {doctor.licenseNumber}</div>}
                  <div style={{ marginTop: 4, height: 2, background: TEAL, borderRadius: 2 }} />
                </div>
              </div>

              {/* Patient info */}
              <div style={{ display: 'flex', gap: 0, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
                {[
                  { label: 'PATIENT', value: patientName },
                  { label: 'DATE', value: new Date().toLocaleDateString('en-IN', { dateStyle: 'long' }) },
                  ...(diagnosis ? [{ label: 'DIAGNOSIS', value: diagnosis }] : []),
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
              </div>

              {/* Rx + Medicines */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 32, fontWeight: 700, fontFamily: 'Georgia, serif', color: '#1e293b', lineHeight: 1 }}>℞</span>
                <Text style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>
                  <MedicineBoxOutlined style={{ marginRight: 5 }} />Medicines
                </Text>
              </div>

              {draftMedicines.map((med, i) => (
                <div key={med._key} style={{ padding: '9px 0', borderBottom: '1px solid #f1f5f9' }}>
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

              {draftTests.length > 0 && (
                <>
                  <Divider style={{ margin: '14px 0' }} />
                  <Text style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>
                    <ExperimentOutlined style={{ marginRight: 5 }} />Lab Tests
                  </Text>
                  {draftTests.map((test, i) => (
                    <div key={test._key} style={{ padding: '7px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Text style={{ color: '#cbd5e1', minWidth: 20, fontSize: 13 }}>{i + 1}.</Text>
                      <Text strong style={{ fontSize: 13 }}>{test.name}</Text>
                      {test.category && <Tag style={{ fontSize: 11, background: '#f5f3ff', borderColor: '#ddd6fe', color: '#6d28d9' }}>{test.category}</Tag>}
                      {test.instructions && <Text type="secondary" style={{ fontSize: 12 }}>— {test.instructions}</Text>}
                    </div>
                  ))}
                </>
              )}

              {notes && (
                <>
                  <Divider style={{ margin: '14px 0' }} />
                  <div style={{ background: '#fffbe6', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px' }}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 3 }}>Doctor&apos;s Notes</Text>
                    <Text style={{ fontSize: 13 }}>{notes}</Text>
                  </div>
                </>
              )}

              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ textAlign: 'center', minWidth: 180 }}>
                  <div style={{
                    fontFamily: "'Brush Script MT', 'Segoe Script', 'Dancing Script', cursive",
                    fontSize: 28, color: '#1e293b', lineHeight: 1.2, marginBottom: 4,
                  }}>
                    {doctorName}
                  </div>
                  <div style={{ width: '100%', borderBottom: `1px solid #0e7490`, marginBottom: 6 }} />
                  <Text style={{ fontSize: 12, color: '#64748b' }}>{doctorName}</Text>
                  {doctor?.specialty && <div style={{ fontSize: 11, color: '#94a3b8' }}>{doctor.specialty}</div>}
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

export default function CreatePrescriptionPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>}>
      <PrescriptionBuilder />
    </Suspense>
  );
}

