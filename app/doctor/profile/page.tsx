'use client';

import React, { useEffect, useState } from 'react';
import {
  Card, Form, Input, InputNumber, Select, Button, Typography,
  message, Spin, Divider,
} from 'antd';
import { UserOutlined, SaveOutlined } from '@ant-design/icons';
import axios from 'axios';
import { apiCall } from '../../../lib/api';

const { Title } = Typography;

const specialties = [
  'General Physician', 'Cardiologist', 'Dermatologist', 'Neurologist',
  'Orthopedist', 'Pediatrician', 'Psychiatrist', 'Gynecologist',
  'Ophthalmologist', 'ENT Specialist',
];

const languages = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Bengali', 'Marathi', 'Gujarati'];

export default function DoctorProfilePage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await apiCall('GET', '/api/doctor/profile');
        const profile = res.data ?? res;
        form.setFieldsValue({
          ...profile,
          languages: profile.languages || [],
          qualifications: profile.qualifications || [],
        });
      } catch {
        // profile may not exist yet
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [form]);

  const handleSave = async (values: unknown) => {
    setSaving(true);
    try {
      await apiCall('PATCH', '/api/doctor/profile', values);
      message.success('Profile updated successfully!');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) message.error(err.response?.data?.message || 'Failed to save');
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

      <Card style={{ borderRadius: 12, maxWidth: 700 }}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Divider>Professional Info</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item label="Specialty" name="specialty">
              <Select placeholder="Select specialty" allowClear showSearch>
                {specialties.map((s) => (
                  <Select.Option key={s} value={s}>{s}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="License Number" name="licenseNumber">
              <Input placeholder="Medical license number" />
            </Form.Item>
            <Form.Item label="Years of Experience" name="yearsOfExperience">
              <InputNumber min={0} max={60} style={{ width: '100%' }} placeholder="e.g. 10" />
            </Form.Item>
            <Form.Item label="Consultation Fee (₹)" name="consultationFee">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="e.g. 500" />
            </Form.Item>
          </div>

          <Form.Item label="Languages Spoken" name="languages">
            <Select mode="multiple" placeholder="Select languages">
              {languages.map((l) => <Select.Option key={l} value={l}>{l}</Select.Option>)}
            </Select>
          </Form.Item>

          <Form.Item label="Qualifications" name="qualifications">
            <Select mode="tags" placeholder="Type and press Enter (e.g. MBBS, MD)" tokenSeparators={[',']} />
          </Form.Item>

          <Form.Item label="Bio" name="bio">
            <Input.TextArea rows={4} placeholder="Brief professional bio..." showCount maxLength={500} />
          </Form.Item>

          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} size="large">
            Save Changes
          </Button>
        </Form>
      </Card>
    </div>
  );
}
