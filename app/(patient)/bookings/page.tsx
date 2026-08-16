'use client';

import React, { useEffect, useState, Suspense } from 'react';
import {
  Card, Table, Tag, Button, Modal, Form, Input, Typography,
  message, Spin, Tabs, Alert, Tooltip,
} from 'antd';
import { CalendarOutlined, InfoCircleOutlined, VideoCameraOutlined, MessageOutlined, EnvironmentOutlined } from '@ant-design/icons';
import type { TablePaginationConfig } from 'antd';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { apiCall } from '../../../lib/api';

const { Title, Text } = Typography;

interface Booking {
  id: string;
  scheduledAt: string;
  createdAt?: string;
  status: string;
  cancelReason?: string;
  consultationFeeCents?: number;
  consultationType?: 'video' | 'offline';
  doctor?: { fullName?: string; email?: string };
  payment?: { amountCents?: number; currency?: string; status?: string };
}

const statusColor: Record<string, string> = {
  pending: 'orange',
  confirmed: 'blue',
  paid: 'green',
  active: 'cyan',
  completed: 'geekblue',
  cancelled: 'red',
  refunded: 'purple',
};

const isWithin24h = (createdAt?: string) => {
  if (!createdAt) return false;
  const diff = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  return diff <= 24;
};

const isWithin2HoursOfAppointment = (scheduledAt: string) => {
  const diff = (new Date(scheduledAt).getTime() - Date.now()) / (1000 * 60 * 60);
  return diff >= 0 && diff < 2;
};

const isUpcoming = (status: string) => ['pending', 'confirmed', 'paid', 'active'].includes(status);

function BookingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [cancelModal, setCancelModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [cancelLoading, setCancelLoading] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('upcoming');

  useEffect(() => {
    if (searchParams.get('success')) {
      message.success('Payment successful! Your booking is confirmed.');
    }
  }, [searchParams]);

  const fetchBookings = async (page = 1) => {
    setLoading(true);
    try {
      const res = await apiCall('GET', `/api/bookings?page=${page}&limit=50`);
      const all: Booking[] = res.data || res || [];
      setBookings(all);
      setPagination((prev) => ({ ...prev, current: page, total: res.total || all.length }));
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBookings(); }, []);

  const handlePayNow = async (bookingId: string) => {
    setPayingId(bookingId);
    try {
      const res = await apiCall('POST', '/api/payments/initiate', { bookingId });
      const url = res.data?.url ?? res.url;
      if (url) {
        window.location.href = url;
      } else {
        message.error('Could not get payment URL');
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) message.error(err.response?.data?.message || 'Payment initiation failed');
      else message.error('An error occurred');
    } finally {
      setPayingId(null);
    }
  };

  const handleCancel = async (values: { reason?: string }) => {
    if (!cancelModal.id) return;
    setCancelLoading(true);
    try {
      const res = await apiCall('PATCH', `/api/bookings/${cancelModal.id}/cancel`, { reason: values.reason });
      message.success('Booking cancelled. If you paid, contact support or wait for admin to process your refund.');
      setCancelModal({ open: false, id: null });
      fetchBookings(pagination.current);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) message.error(err.response?.data?.message || 'Failed to cancel');
      else message.error('An error occurred');
    } finally {
      setCancelLoading(false);
    }
  };

  const sortDesc = (a: Booking, b: Booking) =>
    new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime();
  const upcoming = bookings.filter((b) => isUpcoming(b.status)).sort(sortDesc);
  const past = bookings.filter((b) => !isUpcoming(b.status)).sort(sortDesc);
  const displayed = activeTab === 'upcoming' ? upcoming : past;

  const getFee = (b: Booking) => {
    const cents = b.payment?.amountCents ?? b.consultationFeeCents;
    return cents ? `₹${(cents / 100).toFixed(0)}` : '—';
  };

  const columns = [
    {
      title: 'Doctor',
      key: 'doctor',
      render: (_: unknown, r: Booking) => (
        <Text strong>{r.doctor?.fullName || '—'}</Text>
      ),
    },
    {
      title: 'Date & Time',
      key: 'scheduledAt',
      render: (_: unknown, r: Booking) => new Date(r.scheduledAt).toLocaleString(),
    },
    {
      title: 'Fee',
      key: 'fee',
      render: (_: unknown, r: Booking) => getFee(r),
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
      title: 'Status',
      key: 'status',
      render: (_: unknown, r: Booking) => (
        <>
          <Tag color={statusColor[r.status] ?? 'default'}>{r.status?.toUpperCase()}</Tag>
          {r.payment?.status === 'refunded' && (
            <Tag color="purple" style={{ marginLeft: 4 }}>REFUNDED</Tag>
          )}
        </>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, r: Booking) => {
        const refundEligible = isWithin24h(r.createdAt) && r.payment?.status === 'success';
        const tooClose = isWithin2HoursOfAppointment(r.scheduledAt);
        const isPending = r.status === 'pending';
        return (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {isPending && (
              <Button
                size="small"
                type="primary"
                loading={payingId === r.id}
                onClick={() => void handlePayNow(r.id)}
              >
                Pay Now
              </Button>
            )}
            {isUpcoming(r.status) && (
              <Tooltip title={
                tooClose
                  ? 'Cannot cancel within 2 hours of appointment'
                  : refundEligible
                    ? 'Cancel now for a full refund (within 24h window)'
                    : 'Cancel — no refund after 24h of booking'
              }>
                <Button
                  size="small"
                  danger
                  disabled={tooClose}
                  onClick={() => !tooClose && setCancelModal({ open: true, id: r.id })}
                >
                  Cancel
                </Button>
              </Tooltip>
            )}
            {['paid', 'active'].includes(r.status) && r.consultationType === 'video' && (
              <Button
                size="small"
                icon={<VideoCameraOutlined />}
                onClick={() => router.push(`/call/${r.id}`)}
              >
                Join Call
              </Button>
            )}
            {['paid', 'active', 'completed'].includes(r.status) && (
              <Button
                size="small"
                icon={<MessageOutlined />}
                onClick={() => router.push(`/chat/${r.id}`)}
              >
                Chat
              </Button>
            )}
            {r.status === 'completed' && (
              <Button size="small" onClick={() => router.push('/prescriptions')}>
                View Rx
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        <CalendarOutlined /> My Bookings
      </Title>

      <Alert
        type="info"
        icon={<InfoCircleOutlined />}
        showIcon
        message="Cancellation Policy: Cancel within 24 hours of booking for a full refund. Cancellations within 2 hours of the appointment time are not allowed."
        style={{ marginBottom: 16, borderRadius: 8 }}
      />

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
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: displayed.length,
              showSizeChanger: false,
            }}
            onChange={(p: TablePaginationConfig) => fetchBookings(p.current || 1)}
            bordered
            size="middle"
            scroll={{ x: 'max-content' }}
          />
        )}
      </Card>

      <Modal
        title="Cancel Booking"
        open={cancelModal.open}
        onCancel={() => setCancelModal({ open: false, id: null })}
        footer={null}
        destroyOnHidden
      >
        {cancelModal.id && (() => {
          const booking = bookings.find((b) => b.id === cancelModal.id);
          const refundEligible = isWithin24h(booking?.createdAt) && booking?.payment?.status === 'success';
          const hasPaid = booking?.payment?.status === 'success';
          return refundEligible ? (
            <Alert type="success" message="You are within the 24-hour window — a full refund will be initiated automatically." style={{ marginBottom: 16 }} />
          ) : hasPaid ? (
            <Alert type="warning" message="No refund will be issued as it has been more than 24 hours since booking." style={{ marginBottom: 16 }} />
          ) : (
            <Alert type="info" message="This booking has not been paid. Cancelling will free the slot." style={{ marginBottom: 16 }} />
          );
        })()}
        <Form layout="vertical" onFinish={handleCancel}>
          <Form.Item label="Reason for cancellation (optional)" name="reason">
            <Input.TextArea rows={3} placeholder="Let us know why you're cancelling..." />
          </Form.Item>
          <Button type="primary" danger htmlType="submit" block loading={cancelLoading}>
            Confirm Cancellation
          </Button>
        </Form>
      </Modal>
    </div>
  );
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>}>
      <BookingsContent />
    </Suspense>
  );
}
