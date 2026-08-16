'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Typography, Spin, Empty, Tag, Divider, Button, Collapse, message, Modal, Form, Input, InputNumber, Space } from 'antd';
import {
  FileTextOutlined, MedicineBoxOutlined, ExperimentOutlined,
  DownloadOutlined, PrinterOutlined, UserOutlined, ShoppingCartOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { apiCall } from '../../../lib/api';

const { Title, Text } = Typography;

const TEAL = '#0e7490';

interface Medicine {
  name: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  notes?: string;
}

interface Test {
  name: string;
  category?: string;
  instructions?: string;
}

interface Prescription {
  id: string;
  diagnosis?: string;
  notes?: string;
  medicines: Medicine[];
  tests: Test[];
  pdfUrl?: string;
  createdAt: string;
  booking?: {
    scheduledAt: string;
    doctor?: {
      fullName?: string;
      doctorProfile?: { specialty?: string; qualifications?: string[]; licenseNumber?: string };
    };
  };
}

interface OrderItemForm {
  name: string;
  genericName?: string;
  quantity: number;
  unitPriceCents: number;
}

function OrderMedicinesModal({ rx, open, onClose }: { rx: Prescription; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [form] = Form.useForm();
  const [items, setItems] = useState<OrderItemForm[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setItems(rx.medicines.map((med) => ({
      name: med.name,
      genericName: med.genericName,
      quantity: 1,
      unitPriceCents: 0,
    })));
    apiCall('GET', '/api/patients/profile')
      .then((res) => {
        const profile = res.data ?? res;
        form.setFieldsValue({
          deliveryAddressLine1: profile?.address ?? '',
          deliveryCity: profile?.city ?? '',
          deliveryState: profile?.state ?? '',
        });
      })
      .catch(() => { /* prefill is best-effort */ });
  }, [open, rx, form]);

  const updateQuantity = (index: number, quantity: number) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, quantity } : item)));
  };

  const updateUnitPrice = (index: number, rupees: number) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, unitPriceCents: Math.round(rupees * 100) } : item)));
  };

  const handleSubmit = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    setSubmitting(true);
    try {
      await apiCall('POST', '/api/medicine-orders', {
        prescriptionId: rx.id,
        items,
        ...values,
      });
      message.success('Order placed');
      onClose();
      router.push('/orders');
    } catch {
      message.error('Could not place order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={<span><ShoppingCartOutlined style={{ marginRight: 8 }} />Order These Medicines</span>}
      open={open}
      onCancel={onClose}
      width={600}
      destroyOnClose
      footer={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={submitting} onClick={() => void handleSubmit()}>
            Place Order
          </Button>
        </Space>
      }
    >
      <div style={{ marginBottom: 16 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 100%', minWidth: 0 }}>
              <Text strong>{item.name}</Text>
              {item.genericName && <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>({item.genericName})</Text>}
            </div>
            <InputNumber min={1} value={item.quantity} onChange={(v) => updateQuantity(i, v ?? 1)} addonBefore="Qty" style={{ width: 120 }} />
            <InputNumber min={0} value={item.unitPriceCents / 100} onChange={(v) => updateUnitPrice(i, v ?? 0)} addonBefore="₹" style={{ width: 130 }} />
          </div>
        ))}
      </div>

      <Form form={form} layout="vertical">
        <Form.Item name="deliveryAddressLine1" label="Address Line 1" rules={[{ required: true, message: 'Required' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="deliveryAddressLine2" label="Address Line 2 (optional)">
          <Input />
        </Form.Item>
        <Space.Compact block>
          <Form.Item name="deliveryCity" label="City" rules={[{ required: true, message: 'Required' }]} style={{ flex: 1 }}>
            <Input />
          </Form.Item>
          <Form.Item name="deliveryState" label="State" rules={[{ required: true, message: 'Required' }]} style={{ flex: 1 }}>
            <Input />
          </Form.Item>
        </Space.Compact>
        <Space.Compact block>
          <Form.Item name="deliveryPincode" label="Pincode" rules={[{ required: true, message: 'Required' }]} style={{ flex: 1 }}>
            <Input />
          </Form.Item>
          <Form.Item name="deliveryPhone" label="Delivery Phone" rules={[{ required: true, message: 'Required' }]} style={{ flex: 1 }}>
            <Input />
          </Form.Item>
        </Space.Compact>
      </Form>
    </Modal>
  );
}

function PrescriptionBody({ rx, doctorName, specialty, qualifications, licenseNo, dateStr, refNo }: {
  rx: Prescription;
  doctorName: string;
  specialty: string;
  qualifications: string;
  licenseNo: string;
  dateStr: string;
  refNo: string;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await apiCall('GET', `/api/prescriptions/${rx.id}/pdf`);
      const url: string = res.data?.url ?? res.url;
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noreferrer';
      a.click();
    } catch {
      message.error('Could not generate download link');
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML ?? '';
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Prescription — ${doctorName}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
        .header { display: flex; justify-content: space-between; padding-bottom: 14px; border-bottom: 3px solid ${TEAL}; margin-bottom: 14px; }
        .logo-wrap { display: flex; align-items: center; gap: 12px; }
        .logo-circle { width: 44px; height: 44px; border-radius: 50%; background: ${TEAL}; display: flex; align-items: center; justify-content: center; font-size: 22px; color: white; }
        .patient-row { display: flex; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px; overflow: hidden; }
        .patient-cell { flex: 1; padding: 9px 16px; background: #f8fafc; border-right: 1px solid #e2e8f0; }
        .patient-cell.diag { flex: 2; }
        .patient-cell:last-child { border-right: none; }
        .label { font-size: 10px; color: #94a3b8; font-weight: 600; letter-spacing: 0.6px; margin-bottom: 3px; }
        .val { font-size: 14px; font-weight: 600; color: #1e293b; }
        .rx-row { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; }
        .rx { font-size: 34px; font-weight: 700; font-family: Georgia, serif; }
        .section-title { font-weight: 700; font-size: 14px; color: #374151; margin-bottom: 10px; }
        .med-row { padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
        .med-name { font-weight: 700; font-size: 15px; }
        .med-generic { font-size: 12px; color: #94a3b8; margin-left: 6px; }
        .med-details { margin-left: 22px; font-size: 13px; color: #475569; margin-top: 5px; }
        .dosage-badge { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 1px 8px; margin-right: 8px; font-weight: 600; font-size: 12px; }
        .sep { color: #cbd5e1; margin: 0 6px; }
        .test-row { padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
        .notes-box { background: #fffbe6; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 16px; }
        .notes-label { font-size: 11px; color: #92400e; font-weight: 600; margin-bottom: 3px; }
        .sig-block { margin-top: 40px; text-align: right; }
        .sig-line { display: inline-block; width: 160px; border-bottom: 1px solid ${TEAL}; margin-bottom: 6px; }
        .teal-line { height: 2px; background: ${TEAL}; border-radius: 2px; margin-top: 5px; }
      </style></head>
      <body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  return (
    <div>
      <div ref={printRef}>
        {/* ── Prescription letterhead ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          paddingBottom: 16, borderBottom: `3px solid ${TEAL}`, marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-full.png" alt="ZyroHealth" style={{ height: 28, width: 'auto', display: 'block', marginBottom: 4 }} />
              <div style={{ fontSize: 12, color: '#64748b' }}>Digital Health Platform</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#111' }}>{doctorName}</div>
            {specialty && <div style={{ fontSize: 13, color: '#374151' }}>{specialty}</div>}
            {qualifications && <div style={{ fontSize: 12, color: '#64748b' }}>{qualifications}</div>}
            {licenseNo && <div style={{ fontSize: 11, color: '#94a3b8' }}>Reg. No.: {licenseNo}</div>}
            <div style={{ marginTop: 5, height: 2, background: TEAL, borderRadius: 2 }} />
          </div>
        </div>

        {/* ── Patient info row ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', marginBottom: 22 }}>
          {[
            { label: 'PATIENT', value: 'You', flex: 1 },
            { label: 'DATE', value: dateStr, flex: 1 },
            { label: 'REF. NO.', value: refNo, flex: 1 },
            ...(rx.diagnosis ? [{ label: 'DIAGNOSIS', value: rx.diagnosis, flex: 2 }] : []),
          ].map((item, i, arr) => (
            <div key={item.label} style={{
              flex: item.flex,
              minWidth: 120,
              padding: '9px 16px',
              borderRight: i < arr.length - 1 ? '1px solid #e2e8f0' : 'none',
              background: '#f8fafc',
              wordBreak: 'break-word',
            }}>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, letterSpacing: 0.6, marginBottom: 3 }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* ── Rx + Medicines ── */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 34, fontWeight: 700, fontFamily: 'Georgia, serif', color: '#1e293b', lineHeight: 1 }}>℞</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#374151' }}>
            <MedicineBoxOutlined style={{ marginRight: 6 }} />Medicines
          </span>
        </div>

        {rx.medicines.map((med, i) => (
          <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 5 }}>
              <span style={{ color: '#cbd5e1', minWidth: 22, fontSize: 13 }}>{i + 1}.</span>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{med.name}</span>
              {med.genericName && <span style={{ fontSize: 12, color: '#94a3b8' }}>({med.genericName})</span>}
            </div>
            <div style={{ marginLeft: 22, fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
              <span style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: 4, padding: '1px 8px', marginRight: 8,
                fontWeight: 600, fontSize: 12,
              }}>{med.dosage}</span>
              {med.frequency}
              <span style={{ color: '#cbd5e1', margin: '0 6px' }}>·</span>
              {med.duration}
              <span style={{ color: '#cbd5e1', margin: '0 6px' }}>·</span>
              <span style={{ color: '#94a3b8' }}>{med.route}</span>
              {med.notes && <span style={{ color: '#94a3b8', marginLeft: 8 }}>· {med.notes}</span>}
            </div>
          </div>
        ))}

        {/* ── Lab Tests ── */}
        {rx.tests.length > 0 && (
          <>
            <Divider style={{ margin: '16px 0' }} />
            <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', marginBottom: 10 }}>
              <ExperimentOutlined style={{ marginRight: 6 }} />Lab Tests
            </div>
            {rx.tests.map((test, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#cbd5e1', minWidth: 22, fontSize: 13 }}>{i + 1}.</span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{test.name}</span>
                {test.category && (
                  <Tag style={{ fontSize: 11, background: '#f5f3ff', borderColor: '#ddd6fe', color: '#6d28d9', margin: 0 }}>{test.category}</Tag>
                )}
                {test.instructions && <span style={{ fontSize: 12, color: '#94a3b8' }}>— {test.instructions}</span>}
              </div>
            ))}
          </>
        )}

        {/* ── Doctor Notes ── */}
        {rx.notes && (
          <>
            <Divider style={{ margin: '16px 0' }} />
            <div style={{ background: '#fffbe6', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 16px' }}>
              <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600, marginBottom: 3 }}>DOCTOR&apos;S NOTES</div>
              <div style={{ fontSize: 13, color: '#1e293b' }}>{rx.notes}</div>
            </div>
          </>
        )}

        {/* ── Signature ── */}
        <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ textAlign: 'center', minWidth: 180 }}>
            <div style={{
              fontFamily: "'Brush Script MT', 'Segoe Script', 'Dancing Script', cursive",
              fontSize: 28, color: '#1e293b', lineHeight: 1.2, marginBottom: 4,
            }}>
              {doctorName}
            </div>
            <div style={{ width: '100%', borderBottom: `1px solid ${TEAL}`, marginBottom: 6 }} />
            <div style={{ fontSize: 12, color: '#64748b' }}>{doctorName}</div>
            {specialty && <div style={{ fontSize: 11, color: '#94a3b8' }}>{specialty}</div>}
          </div>
        </div>
      </div>

      {/* ── Download / Print (outside print capture area) ── */}
      <div style={{
        marginTop: 16, paddingTop: 14,
        borderTop: '1px solid #f1f5f9',
        display: 'flex', justifyContent: 'flex-end', gap: 8,
      }}>
        {rx.medicines.length > 0 && (
          <Button type="primary" icon={<ShoppingCartOutlined />} onClick={() => setOrderOpen(true)}>
            Order These Medicines
          </Button>
        )}
        {rx.pdfUrl && (
          <Button icon={<DownloadOutlined />} loading={downloading} onClick={() => void handleDownload()}>
            Download PDF
          </Button>
        )}
        <Button icon={<PrinterOutlined />} onClick={handlePrint}>
          Print
        </Button>
      </div>

      {rx.medicines.length > 0 && (
        <OrderMedicinesModal rx={rx} open={orderOpen} onClose={() => setOrderOpen(false)} />
      )}
    </div>
  );
}

export default function PrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiCall('GET', '/api/patients/prescriptions')
      .then((res) => {
        const payload = res.data ?? res;
        setPrescriptions(payload.data || payload || []);
      })
      .catch(() => setPrescriptions([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 20 }}>
        <FileTextOutlined /> My Prescriptions
      </Title>

      {prescriptions.length === 0 ? (
        <Empty description="No prescriptions yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Collapse
          accordion={false}
          items={prescriptions.map((rx) => {
            const rawName = rx.booking?.doctor?.fullName ?? '';
            const doctorName = rawName
              ? (rawName.toLowerCase().startsWith('dr.') ? rawName : `Dr. ${rawName}`)
              : 'Doctor';
            const specialty = rx.booking?.doctor?.doctorProfile?.specialty ?? '';
            const qualifications = (rx.booking?.doctor?.doctorProfile?.qualifications ?? []).join(', ');
            const licenseNo = rx.booking?.doctor?.doctorProfile?.licenseNumber ?? '';
            const dateStr = new Date(rx.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' });
            const refNo = rx.id.slice(0, 8).toUpperCase();

            return {
              key: rx.id,
              label: (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
                    <UserOutlined style={{ color: TEAL }} />
                    <Text strong style={{ wordBreak: 'break-word' }}>{doctorName}</Text>
                    {specialty && <Tag color="blue" style={{ fontSize: 11 }}>{specialty}</Tag>}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      · {rx.medicines.length} medicine{rx.medicines.length !== 1 ? 's' : ''}
                      {rx.tests.length > 0 && `, ${rx.tests.length} test${rx.tests.length !== 1 ? 's' : ''}`}
                    </Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12, flexShrink: 0, marginLeft: 16 }}>
                    {dateStr}
                  </Text>
                </div>
              ),
              children: (
                <PrescriptionBody
                  rx={rx}
                  doctorName={doctorName}
                  specialty={specialty}
                  qualifications={qualifications}
                  licenseNo={licenseNo}
                  dateStr={dateStr}
                  refNo={refNo}
                />
              ),
              style: {
                marginBottom: 8,
                borderRadius: 8,
                border: `1px solid #e2e8f0`,
                overflow: 'hidden',
              },
            };
          })}
          style={{ background: 'transparent', border: 'none' }}
        />
      )}
    </div>
  );
}
