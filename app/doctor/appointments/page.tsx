'use client';

import React, { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Button, Modal, Typography, message, Spin, Tabs, Space,
} from 'antd';
import {
  CheckCircleOutlined, FileTextOutlined, VideoCameraOutlined,
  MessageOutlined, EnvironmentOutlined,
} from '@ant-design/icons';
import type { TablePaginationConfig } from 'antd';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { apiCall } from '../../../lib/api';

const { Title, Text } = Typography;

interface Booking {
  id: string;
  scheduledAt: string;
  status: string;
  cancelReason?: string;
  consultationFeeCents?: number;
  consultationType?: 'video' | 'offline';
  patient?: { fullName?: string; phoneNumber?: string; email?: string };
  payment?: { amountCents?: number; status?: string };
}

const statusColor: Record<string, string> = {
  pending: 'orange',
  confirmed: 'blue',
  paid: 'green',
  active: 'cyan',
  completed: 'geekblue',
  cancelled: 'red',
};

const isUpcoming = (status: string) => ['pending', 'confirmed', 'paid', 'active'].includes(status);

export default function AppointmentsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [completing, setCompleting] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await apiCall('GET', '/api/bookings?limit=50');
      setBookings(res.data || res || []);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBookings(); }, []);

  const handleComplete = async (id: string) => {
    setCompleting(id);
    try {
      await apiCall('PATCH', `/api/bookings/${id}/complete`);
      message.success('Appointment marked as complete');
      fetchBookings();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) message.error(err.response?.data?.message || 'Failed');
    } finally {
      setCompleting(null);
    }
  };

  const sortDesc = (a: Booking, b: Booking) =>
    new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime();
  const upcoming = bookings.filter((b) => isUpcoming(b.status)).sort(sortDesc);
  const past = bookings.filter((b) => !isUpcoming(b.status)).sort(sortDesc);
  const displayed = activeTab === 'upcoming' ? upcoming : past;

  const columns = [
    {
      title: 'Patient',
      key: 'patient',
      render: (_: unknown, r: Booking) => (
        <div>
          <Text strong>{r.patient?.fullName || '—'}</Text>
          {r.patient?.phoneNumber && (
            <div><Text type="secondary" style={{ fontSize: 12 }}>{r.patient.phoneNumber}</Text></div>
          )}
        </div>
      ),
    },
    {
      title: 'Date & Time',
      key: 'scheduledAt',
      render: (_: unknown, r: Booking) => new Date(r.scheduledAt).toLocaleString(),
    },
    {
      title: 'Type',
      key: 'type',
      render: (_: unknown, r: Booking) => (
        r.consultationType === 'offline'
          ? <Tag icon={<EnvironmentOutlined />} color="green">In-Person</Tag>
          : <Tag icon={<VideoCameraOutlined />} color="blue">Video</Tag>
      ),
    },
    {
      title: 'Fee',
      key: 'fee',
      render: (_: unknown, r: Booking) => {
        const cents = r.payment?.amountCents ?? r.consultationFeeCents;
        return cents ? `₹${(cents / 100).toFixed(0)}` : '—';
      },
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: unknown, r: Booking) => (
        <Tag color={statusColor[r.status] ?? 'default'}>{r.status?.toUpperCase()}</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, r: Booking) => (
        <Space wrap>
          <Button size="small" onClick={() => setDetailModal({ open: true, booking: r })}>
            Details
          </Button>
          {['paid', 'active'].includes(r.status) && (
            <>
              {r.consultationType !== 'offline' && (
                <Button
                  size="small"
                  type="primary"
                  icon={<VideoCameraOutlined />}
                  onClick={() => router.push(`/doctor/call/${r.id}`)}
                  style={{ background: '#0e7490', border: 'none' }}
                >
                  Start Call
                </Button>
              )}
              <Button
                size="small"
                icon={<MessageOutlined />}
                onClick={() => router.push(`/doctor/chat/${r.id}`)}
              >
                Chat
              </Button>
              <Button
                size="small"
                icon={<CheckCircleOutlined />}
                loading={completing === r.id}
                onClick={() => handleComplete(r.id)}
              >
                Complete
              </Button>
              <Button
                size="small"
                icon={<FileTextOutlined />}
                onClick={() => router.push(`/doctor/prescriptions/create?bookingId=${r.id}`)}
              >
                Prescribe
              </Button>
            </>
          )}
          {r.status === 'completed' && (
            <Button
              size="small"
              icon={<MessageOutlined />}
              onClick={() => router.push(`/doctor/chat/${r.id}`)}
            >
              Chat
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>Appointments</Title>

      <Card style={{ borderRadius: 12 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'upcoming', label: `Upcoming (${upcoming.length})` },
            { key: 'past', label: `Past (${past.length})` },
          ]}
          style={{ marginBottom: 16 }}
        />

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
        ) : (
          <Table
            columns={columns}
            dataSource={displayed.map((b) => ({ ...b, key: b.id }))}
            bordered
            size="middle"
            pagination={{ pageSize: 10, showSizeChanger: false } as TablePaginationConfig}
          />
        )}
      </Card>

      <Modal
        title="Patient Details"
        open={detailModal.open}
        onCancel={() => setDetailModal({ open: false, booking: null })}
        footer={null}
        destroyOnHidden
      >
        {detailModal.booking && (
          <div>
            <p><Text strong>Name:</Text> {detailModal.booking.patient?.fullName || '—'}</p>
            <p><Text strong>Phone:</Text> {detailModal.booking.patient?.phoneNumber || '—'}</p>
            <p><Text strong>Email:</Text> {detailModal.booking.patient?.email || '—'}</p>
            <p><Text strong>Scheduled:</Text> {new Date(detailModal.booking.scheduledAt).toLocaleString()}</p>
            <p><Text strong>Type:</Text>{' '}
              {detailModal.booking.consultationType === 'offline'
                ? <Tag icon={<EnvironmentOutlined />} color="green">In-Person</Tag>
                : <Tag icon={<VideoCameraOutlined />} color="blue">Video Call</Tag>}
            </p>
            <p><Text strong>Status:</Text> <Tag color={statusColor[detailModal.booking.status]}>{detailModal.booking.status?.toUpperCase()}</Tag></p>
          </div>
        )}
      </Modal>
    </div>
  );
}
