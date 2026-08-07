'use client';

import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Typography, Button, List, Tag, Badge, Spin, Empty } from 'antd';
import {
  CalendarOutlined, TeamOutlined, RobotOutlined, RightOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { apiCall } from '../../../lib/api';
import { getUser } from '../../../lib/auth';
import axios from 'axios';

const { Title, Text } = Typography;

interface Booking {
  id: string;
  scheduledAt: string;
  status: string;
  doctorProfile?: { user?: { fullName?: string }; specialty?: string };
}

export default function PatientDashboard() {
  const router = useRouter();
  const user = getUser();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await apiCall('GET', '/api/bookings?limit=5');
        setBookings(res.data || res || []);
      } catch (err: unknown) {
        if (!axios.isAxiosError(err)) console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const statusColor: Record<string, string> = {
    pending: 'orange',
    confirmed: 'blue',
    completed: 'green',
    cancelled: 'red',
  };

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        Welcome back{user?.fullName ? `, ${user.fullName}` : ''} 👋
      </Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card
            hoverable
            onClick={() => router.push('/doctors')}
            style={{ textAlign: 'center', borderRadius: 12 }}
          >
            <TeamOutlined style={{ fontSize: 32, color: '#1677ff', marginBottom: 12 }} />
            <Title level={5} style={{ margin: 0 }}>Find a Doctor</Title>
            <Text type="secondary">Browse specialists near you</Text>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            hoverable
            onClick={() => router.push('/ai')}
            style={{ textAlign: 'center', borderRadius: 12 }}
          >
            <RobotOutlined style={{ fontSize: 32, color: '#722ed1', marginBottom: 12 }} />
            <Title level={5} style={{ margin: 0 }}>AI Doctor</Title>
            <Text type="secondary">Chat with AI for quick advice</Text>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            hoverable
            onClick={() => router.push('/bookings')}
            style={{ textAlign: 'center', borderRadius: 12 }}
          >
            <CalendarOutlined style={{ fontSize: 32, color: '#52c41a', marginBottom: 12 }} />
            <Title level={5} style={{ margin: 0 }}>My Bookings</Title>
            <Text type="secondary">View upcoming appointments</Text>
          </Card>
        </Col>
      </Row>

      <Card
        title="Recent Bookings"
        extra={<Button type="link" icon={<RightOutlined />} onClick={() => router.push('/bookings')}>View All</Button>}
        style={{ borderRadius: 12 }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : bookings.length === 0 ? (
          <Empty description="No bookings yet" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Button type="primary" onClick={() => router.push('/doctors')}>Book Now</Button>
          </Empty>
        ) : (
          <List
            dataSource={bookings}
            renderItem={(b) => (
              <List.Item
                key={b.id}
                actions={[
                  <Button key="view" type="link" onClick={() => router.push('/bookings')}>View</Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<Badge color={statusColor[b.status] || 'default'} />}
                  title={b.doctorProfile?.user?.fullName || 'Doctor'}
                  description={
                    <>
                      <Text type="secondary">{b.doctorProfile?.specialty || '—'} · </Text>
                      <Text type="secondary">{new Date(b.scheduledAt).toLocaleString()}</Text>
                    </>
                  }
                />
                <Tag color={statusColor[b.status] || 'default'}>{b.status?.toUpperCase()}</Tag>
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
}
