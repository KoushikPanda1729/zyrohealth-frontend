'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Row, Col, Typography, Tag, Rate, Avatar, Button, Divider,
  Select, DatePicker, Modal, Spin, message, Descriptions, Badge, Empty, Segmented,
} from 'antd';
import {
  UserOutlined, CalendarOutlined, DollarOutlined,
  ClockCircleOutlined, GlobalOutlined, ArrowLeftOutlined,
  VideoCameraOutlined, EnvironmentOutlined,
} from '@ant-design/icons';
import { useRouter, useParams } from 'next/navigation';
import dayjs, { Dayjs } from 'dayjs';
import axios from 'axios';
import { apiCall } from '../../../../lib/api';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface DoctorDetail {
  id: string;
  user: { fullName?: string; email?: string; phoneNumber?: string };
  specialty?: string;
  yearsOfExperience?: number;
  consultationFee?: number;
  rating?: number;
  totalConsultations?: number;
  languages?: string[];
  qualifications?: string[];
  bio?: string;
  isAvailable?: boolean;
  approvalStatus?: string;
}

interface Slot {
  startTime: string;
  endTime: string;
  available?: boolean;
}

export default function DoctorDetailPage() {
  const router = useRouter();
  const params = useParams();
  const doctorId = params.id as string;

  const [doctor, setDoctor] = useState<DoctorDetail | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookingModal, setBookingModal] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [consultationType, setConsultationType] = useState<'video' | 'offline'>('video');

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await apiCall('GET', `/api/doctors/${doctorId}`);
        const payload = res.data ?? res;
        setDoctor(payload.profile ?? payload);
      } catch {
        message.error('Failed to load doctor details');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [doctorId]);

  const fetchSlots = useCallback(async (date: Dayjs) => {
    setSlotsLoading(true);
    try {
      const res = await apiCall('GET', `/api/doctors/${doctorId}/slots?date=${date.format('YYYY-MM-DD')}`);
      const raw: Slot[] = (res.data ?? res ?? []).filter((s: Slot & { available?: boolean }) => s.available !== false);
      setSlots(raw);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [doctorId]);

  const handleDateChange = (date: Dayjs | null) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    if (date) fetchSlots(date);
  };

  const handleBook = async () => {
    if (!selectedDate || !selectedSlot) return;
    setBookingLoading(true);
    try {
      // 1. Create booking
      const bookingRes = await apiCall('POST', '/api/bookings', {
        doctorId,
        scheduledAt: selectedSlot,
        consultationType,
      });
      const booking = bookingRes.data ?? bookingRes;

      // 2. Initiate Stripe Checkout Session
      const payRes = await apiCall('POST', '/api/payments/initiate', {
        bookingId: booking.id,
        currency: 'inr',
      });

      // 3. Redirect to Stripe hosted checkout
      const checkoutUrl = payRes.data?.url ?? payRes.url;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        message.success('Booking confirmed!');
        router.push('/bookings');
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        message.error(err.response?.data?.message || 'Booking failed');
      } else {
        message.error('An error occurred');
      }
    } finally {
      setBookingLoading(false);
      setBookingModal(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  if (!doctor) {
    return <Empty description="Doctor not found"><Button onClick={() => router.back()}>Go Back</Button></Empty>;
  }

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()} style={{ marginBottom: 16 }}>
        Back to Doctors
      </Button>

      <Row gutter={[24, 24]}>
        {/* Doctor Profile Card */}
        <Col xs={24} lg={14}>
          <Card style={{ borderRadius: 12 }}>
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap' }}>
              <Avatar size={80} icon={<UserOutlined />} style={{ background: '#1677ff', flexShrink: 0 }} />
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <Title level={4} style={{ margin: 0, wordBreak: 'break-word' }}>{doctor.user?.fullName || 'Doctor'}</Title>
                {doctor.specialty && <Tag color="blue" style={{ marginBottom: 8 }}>{doctor.specialty}</Tag>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Rate disabled value={Number(doctor.rating) || 0} allowHalf style={{ fontSize: 14 }} />
                  <Text type="secondary">
                    {Number(doctor.rating || 0).toFixed(1)} · {doctor.totalConsultations || 0} consultations
                  </Text>
                </div>
              </div>
            </div>

            <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
              <Descriptions.Item label={<><ClockCircleOutlined /> Experience</>}>
                {doctor.yearsOfExperience ? `${doctor.yearsOfExperience} years` : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={<><DollarOutlined /> Fee</>}>
                {doctor.consultationFee ? `₹${(doctor.consultationFee / 100).toFixed(0)}` : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={<><GlobalOutlined /> Languages</>} span={2}>
                {doctor.languages?.length
                  ? doctor.languages.map((l) => <Tag key={l} color="blue">{l}</Tag>)
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Qualifications" span={2}>
                {doctor.qualifications?.length
                  ? doctor.qualifications.map((q) => <Tag key={q}>{q}</Tag>)
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Status" span={2}>
                <Badge
                  status={doctor.isAvailable ? 'success' : 'default'}
                  text={doctor.isAvailable ? 'Available for consultations' : 'Currently unavailable'}
                />
              </Descriptions.Item>
            </Descriptions>

            {doctor.bio && (
              <>
                <Divider>About</Divider>
                <Paragraph style={{ color: '#555' }}>{doctor.bio}</Paragraph>
              </>
            )}
          </Card>
        </Col>

        {/* Booking Card */}
        <Col xs={24} lg={10}>
          <Card title={<><CalendarOutlined /> Book Appointment</>} style={{ borderRadius: 12 }}>
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>Consultation Type</Text>
              <Segmented
                block
                value={consultationType}
                onChange={(v) => setConsultationType(v as 'video' | 'offline')}
                options={[
                  { label: <span><VideoCameraOutlined /> Video Call</span>, value: 'video' },
                  { label: <span><EnvironmentOutlined /> In-Person Visit</span>, value: 'offline' },
                ]}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>Select Date</Text>
              <DatePicker
                style={{ width: '100%' }}
                disabledDate={(d) => d.isBefore(dayjs(), 'day')}
                onChange={handleDateChange}
                value={selectedDate}
              />
            </div>

            {selectedDate && (
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>Available Slots</Text>
                {slotsLoading ? (
                  <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
                ) : slots.length === 0 ? (
                  <Empty description="No slots available on this date" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <Select
                    style={{ width: '100%' }}
                    placeholder="Select a time slot"
                    value={selectedSlot}
                    onChange={setSelectedSlot}
                  >
                    {slots.map((slot) => (
                      <Option
                        key={slot.startTime}
                        value={`${selectedDate!.format('YYYY-MM-DD')}T${slot.startTime}:00.000Z`}
                      >
                        {slot.startTime} – {slot.endTime}
                      </Option>
                    ))}
                  </Select>
                )}
              </div>
            )}

            {doctor.consultationFee && (
              <div style={{ background: '#f5f7fa', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>Consultation Fee</Text>
                  <Text strong>₹{(doctor.consultationFee / 100).toFixed(0)}</Text>
                </div>
              </div>
            )}

            <Button
              type="primary"
              block
              size="large"
              disabled={!selectedDate || !selectedSlot}
              onClick={() => setBookingModal(true)}
            >
              Confirm & Pay
            </Button>
          </Card>
        </Col>
      </Row>

      <Modal
        title="Confirm Booking"
        open={bookingModal}
        onCancel={() => setBookingModal(false)}
        onOk={handleBook}
        okText="Pay Now"
        confirmLoading={bookingLoading}
        destroyOnHidden
      >
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Doctor">{doctor.user?.fullName}</Descriptions.Item>
          <Descriptions.Item label="Date & Time">
            {selectedSlot ? new Date(selectedSlot).toLocaleString() : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Fee">
            {doctor.consultationFee ? `₹${doctor.consultationFee}` : 'Free'}
          </Descriptions.Item>
          <Descriptions.Item label="Type">
            {consultationType === 'video'
              ? <Tag icon={<VideoCameraOutlined />} color="blue">Video Call</Tag>
              : <Tag icon={<EnvironmentOutlined />} color="green">In-Person Visit</Tag>}
          </Descriptions.Item>
        </Descriptions>
        <Text type="secondary" style={{ marginTop: 12, display: 'block' }}>
          You will be redirected to Stripe to complete the payment.
        </Text>
      </Modal>
    </div>
  );
}
