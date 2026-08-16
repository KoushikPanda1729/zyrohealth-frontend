'use client';

import React, { useEffect, useState, Suspense } from 'react';
import {
  Card, Form, Input, Select, DatePicker, Button, Typography, message,
  Spin, Divider, Alert,
} from 'antd';
import { UserOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import axios from 'axios';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiCall } from '../../../lib/api';

const { Title } = Typography;
const { Option } = Select;

interface PatientProfile {
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  allergies?: string[];
  chronicConditions?: string[];
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSetup = searchParams.get('setup') === '1';
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await apiCall('GET', '/api/patients/profile');
        const profile: PatientProfile = res.data ?? res;
        setHasProfile(true);
        form.setFieldsValue({
          ...profile,
          dateOfBirth: profile.dateOfBirth ? dayjs(profile.dateOfBirth) : undefined,
          allergies: profile.allergies || [],
          chronicConditions: profile.chronicConditions || [],
        });
      } catch (err: unknown) {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          setHasProfile(false);
        }
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [form]);

  const handleSave = async (values: PatientProfile & { dateOfBirth?: dayjs.Dayjs }) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        dateOfBirth: values.dateOfBirth ? (values.dateOfBirth as dayjs.Dayjs).format('YYYY-MM-DD') : undefined,
      };
      if (hasProfile) {
        await apiCall('PATCH', '/api/patients/profile', payload);
      } else {
        await apiCall('POST', '/api/patients/profile', payload);
        setHasProfile(true);
      }
      message.success('Profile saved successfully!');
      if (isSetup) router.replace('/dashboard');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) message.error(err.response?.data?.message || 'Failed to save profile');
      else message.error('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        <UserOutlined /> My Profile
      </Title>

      {isSetup && (
        <Alert
          type="info"
          showIcon
          message="Welcome! Complete your profile to get started."
          description="This helps doctors understand your health background. You can skip and fill it later."
          style={{ marginBottom: 16, borderRadius: 8 }}
          action={
            <Button size="small" onClick={() => router.replace('/dashboard')}>
              Skip for now
            </Button>
          }
        />
      )}

      <Card style={{ borderRadius: 12, maxWidth: 700 }}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Divider>Personal Information</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0 16px' }}>
            <Form.Item label="Date of Birth" name="dateOfBirth">
              <DatePicker style={{ width: '100%' }} disabledDate={(d) => d.isAfter(dayjs())} />
            </Form.Item>
            <Form.Item label="Gender" name="gender">
              <Select placeholder="Select gender" allowClear>
                <Option value="male">Male</Option>
                <Option value="female">Female</Option>
                <Option value="other">Other</Option>
              </Select>
            </Form.Item>
            <Form.Item label="Blood Group" name="bloodGroup">
              <Select placeholder="Select blood group" allowClear>
                {bloodGroups.map((bg) => <Option key={bg} value={bg}>{bg}</Option>)}
              </Select>
            </Form.Item>
          </div>

          <Form.Item label="Allergies" name="allergies">
            <Select mode="tags" placeholder="Type and press Enter to add allergies" tokenSeparators={[',']} />
          </Form.Item>

          <Form.Item label="Chronic Conditions" name="chronicConditions">
            <Select mode="tags" placeholder="Type and press Enter to add conditions" tokenSeparators={[',']} />
          </Form.Item>

          <Divider>Address</Divider>
          <Form.Item label="Address" name="address">
            <Input placeholder="Street address" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0 16px' }}>
            <Form.Item label="City" name="city">
              <Input placeholder="City" />
            </Form.Item>
            <Form.Item label="State" name="state">
              <Input placeholder="State" />
            </Form.Item>
            <Form.Item label="Country" name="country">
              <Input placeholder="Country" />
            </Form.Item>
          </div>

          <Divider>Emergency Contact</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0 16px' }}>
            <Form.Item label="Contact Name" name="emergencyContactName">
              <Input placeholder="Emergency contact name" />
            </Form.Item>
            <Form.Item label="Contact Phone" name="emergencyContactPhone">
              <Input placeholder="+919876543210" />
            </Form.Item>
          </div>

          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} size="large">
            {isSetup ? 'Save & Continue' : hasProfile ? 'Save Changes' : 'Create Profile'}
          </Button>
        </Form>
      </Card>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>}>
      <ProfileContent />
    </Suspense>
  );
}
