'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Row, Col, Input, Select, Slider, Button, Tag, Rate,
  Typography, Spin, Empty, Pagination, Avatar,
} from 'antd';
import { SearchOutlined, UserOutlined, FilterOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { apiCall } from '../../../lib/api';

const { Title, Text } = Typography;
const { Option } = Select;

interface Doctor {
  id: string;
  user: { fullName?: string; email?: string };
  specialty?: string;
  yearsOfExperience?: number;
  consultationFee?: number;
  rating?: number;
  totalConsultations?: number;
  languages?: string[];
  bio?: string;
  isAvailable?: boolean;
}

const specialties = [
  'General Physician', 'Cardiologist', 'Dermatologist', 'Neurologist',
  'Orthopedist', 'Pediatrician', 'Psychiatrist', 'Gynecologist',
  'Ophthalmologist', 'ENT Specialist',
];

export default function DoctorsPage() {
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState<string | undefined>();
  const [maxFee, setMaxFee] = useState<number>(5000);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '12' });
      if (specialty) params.append('specialty', specialty);
      if (maxFee < 5000) params.append('maxFee', String(maxFee));
      const res = await apiCall('GET', `/api/doctors?${params}`);
      const data: Doctor[] = res.data || res || [];
      const filtered = search
        ? data.filter((d) => d.user?.fullName?.toLowerCase().includes(search.toLowerCase()))
        : data;
      setDoctors(filtered);
      setTotal(res.total || filtered.length);
    } catch {
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  }, [page, specialty, maxFee, search]);

  useEffect(() => { fetchDoctors(); }, [fetchDoctors]);

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>Find Doctors</Title>

      <Card style={{ marginBottom: 16, borderRadius: 12 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col flex={1}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search by doctor name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={fetchDoctors}
              allowClear
            />
          </Col>
          <Col>
            <Select
              placeholder="Specialty"
              allowClear
              style={{ width: 180 }}
              value={specialty}
              onChange={(v) => { setSpecialty(v); setPage(1); }}
            >
              {specialties.map((s) => <Option key={s} value={s}>{s}</Option>)}
            </Select>
          </Col>
          <Col>
            <Button icon={<FilterOutlined />} onClick={() => setShowFilters(!showFilters)}>
              Filters
            </Button>
          </Col>
          <Col>
            <Button type="primary" onClick={fetchDoctors}>Search</Button>
          </Col>
        </Row>
        {showFilters && (
          <div style={{ marginTop: 16 }}>
            <Text>Max Fee: ₹{maxFee}</Text>
            <Slider
              min={100}
              max={5000}
              step={100}
              value={maxFee}
              onChange={(v) => setMaxFee(v)}
              style={{ maxWidth: 300 }}
            />
          </div>
        )}
      </Card>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : doctors.length === 0 ? (
        <Empty description="No doctors found" />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {doctors.map((doc) => (
              <Col key={doc.id} xs={24} sm={12} lg={8}>
                <Card
                  hoverable
                  style={{ borderRadius: 12 }}
                  onClick={() => router.push(`/doctors/${doc.id}`)}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <Avatar size={56} icon={<UserOutlined />} style={{ background: '#1677ff', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong style={{ display: 'block', fontSize: 15 }}>
                        {doc.user?.fullName || 'Doctor'}
                      </Text>
                      {doc.specialty && (
                        <Tag color="blue" style={{ marginBottom: 4 }}>{doc.specialty}</Tag>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <Rate disabled defaultValue={Number(doc.rating) || 0} style={{ fontSize: 12 }} allowHalf />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          ({Number(doc.rating || 0).toFixed(1)})
                        </Text>
                      </div>
                      {doc.yearsOfExperience && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {doc.yearsOfExperience} yrs exp
                        </Text>
                      )}
                    </div>
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong style={{ color: '#1677ff' }}>
                      {doc.consultationFee ? `₹${(doc.consultationFee / 100).toFixed(0)}` : 'Fee N/A'}
                    </Text>
                    <Tag color={doc.isAvailable ? 'green' : 'default'}>
                      {doc.isAvailable ? 'Available' : 'Unavailable'}
                    </Tag>
                  </div>
                  <Button type="primary" block style={{ marginTop: 12 }}>
                    Book Consultation
                  </Button>
                </Card>
              </Col>
            ))}
          </Row>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Pagination
              current={page}
              pageSize={12}
              total={total}
              onChange={(p) => setPage(p)}
              showSizeChanger={false}
            />
          </div>
        </>
      )}
    </div>
  );
}
