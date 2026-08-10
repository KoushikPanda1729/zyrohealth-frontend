'use client';

import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, List, Tag, Typography, Spin, Button, Badge } from 'antd';
import {
  CalendarOutlined, UserOutlined, StarOutlined, DollarOutlined, RightOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { apiCall } from '../../../lib/api';
import { getUser } from '../../../lib/auth';

const { Title, Text } = Typography;

interface DashboardData {
  totalBookings?: number;
  todayBookings?: number;
  totalPatients?: number;
  rating?: number;
  totalRevenue?: number;
  recentBookings?: Array<{
    id: string;
    scheduledAt: string;
    status: string;
    patient?: { user?: { fullName?: string } };
  }>;
}

const statusColor: Record<string, string> = {
  pending: 'orange',
  confirmed: 'blue',
  completed: 'green',
  cancelled: 'red',
};

export default function DoctorDashboard() {
  const router = useRouter();
  const user = getUser();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await apiCall('GET', '/api/doctor/dashboard');
        setData(res.data ?? res);
      } catch {
        setData({});
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        Welcome, Dr. {user?.fullName || 'Doctor'} 👋
      </Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Bookings"
              value={data?.totalBookings || 0}
              prefix={<CalendarOutlined />}
              styles={{ content: { color: '#1677ff' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Today's Appointments"
              value={data?.todayBookings || 0}
              prefix={<CalendarOutlined />}
              styles={{ content: { color: '#52c41a' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Patients"
              value={data?.totalPatients || 0}
              prefix={<UserOutlined />}
              styles={{ content: { color: '#722ed1' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Rating"
              value={Number(data?.rating || 0).toFixed(1)}
              prefix={<StarOutlined />}
              suffix="/ 5"
              styles={{ content: { color: '#fa8c16' } }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="Recent Appointments"
        extra={
          <Button type="link" icon={<RightOutlined />} onClick={() => router.push('/doctor/appointments')}>
            View All
          </Button>
        }
        style={{ borderRadius: 12 }}
      >
        {!data?.recentBookings?.length ? (
          <Text type="secondary">No appointments yet</Text>
        ) : (
          <List
            dataSource={data.recentBookings}
            renderItem={(b) => (
              <List.Item
                key={b.id}
                actions={[
                  <Button key="view" type="link" onClick={() => router.push('/doctor/appointments')}>
                    View
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<Badge color={statusColor[b.status] || 'default'} />}
                  title={b.patient?.user?.fullName || 'Patient'}
                  description={new Date(b.scheduledAt).toLocaleString()}
                />
                <Tag color={statusColor[b.status]}>{b.status?.toUpperCase()}</Tag>
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
}
