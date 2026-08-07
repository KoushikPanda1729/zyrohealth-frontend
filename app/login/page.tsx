'use client';

import React, { useState } from 'react';
import {
  Card, Form, Input, Button, Typography, message, Space,
  Segmented, InputNumber, Select, Result, Divider, Upload,
} from 'antd';
import {
  MobileOutlined, LockOutlined, HeartOutlined,
  UserOutlined, MedicineBoxOutlined, CheckCircleOutlined, UploadOutlined,
  MessageOutlined, WhatsAppOutlined,
} from '@ant-design/icons';
import { env } from '../../lib/env';
import { getToken } from '../../lib/auth';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { apiCall } from '../../lib/api';
import { setToken, setRefreshToken, setUser } from '../../lib/auth';

const { Title, Text } = Typography;
const { Option } = Select;

type Step = 'phone' | 'otp' | 'doctor-register' | 'pending' | 'awaiting-approval';

const specialties = [
  'General Physician', 'Cardiologist', 'Dermatologist', 'Neurologist',
  'Orthopedist', 'Pediatrician', 'Psychiatrist', 'Gynecologist',
  'Ophthalmologist', 'ENT Specialist',
];

const languages = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Bengali', 'Marathi'];

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [roleChoice, setRoleChoice] = useState<'patient' | 'doctor'>('patient');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async (values: { phone: string }) => {
    setLoading(true);
    try {
      await apiCall('POST', '/api/auth/send-otp', { phone: values.phone, channel });
      setPhone(values.phone);
      setStep('otp');
      message.success(`OTP sent via ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}!`);
    } catch (err: unknown) {
      message.error(axios.isAxiosError(err) ? err.response?.data?.message || 'Failed to send OTP' : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Role is selected on the OTP screen so verify-otp gets the correct role
  const handleVerifyOtp = async (values: { code: string }) => {
    setLoading(true);
    try {
      const res = await apiCall('POST', '/api/auth/verify-otp', {
        phone,
        code: values.code,
        role: roleChoice,
      });
      const payload = res.data ?? res;
      setToken(payload.accessToken);
      if (payload.refreshToken) setRefreshToken(payload.refreshToken);
      setUser(payload.user);

      if (!payload.isNewUser) {
        // Existing user — use their stored role
        if (payload.user.role === 'doctor') {
          const approvalStatus = payload.user.doctorProfile?.approvalStatus;
          if (approvalStatus === 'approved') {
            router.replace('/doctor/dashboard');
          } else {
            // pending or rejected — don't let them in
            setStep('awaiting-approval');
          }
        } else {
          router.replace('/dashboard');
        }
      } else if (roleChoice === 'doctor') {
        // New doctor — fill registration form
        setStep('doctor-register');
      } else {
        // New patient — complete profile
        router.replace('/profile?setup=1');
      }
    } catch (err: unknown) {
      message.error(axios.isAxiosError(err) ? err.response?.data?.message || 'Invalid OTP' : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorRegister = async (values: {
    fullName?: string;
    specialty?: string;
    licenseNumber?: string;
    yearsOfExperience?: number;
    consultationFee?: number;
    languages?: string[];
    bio?: string;
  }) => {
    setLoading(true);
    try {
      // Save name on the user record
      if (values.fullName) {
        await apiCall('PATCH', '/api/auth/me', { fullName: values.fullName });
      }
      // Save doctor profile
      const { fullName: _n, ...profileData } = values;
      await apiCall('PATCH', '/api/doctor/profile', profileData);
      setStep('pending');
    } catch (err: unknown) {
      message.error(axios.isAxiosError(err) ? err.response?.data?.message || 'Failed to submit' : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #e6f4ff 0%, #f0f5ff 100%)',
      padding: 16,
    }}>
      <Card style={{ width: '100%', maxWidth: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.1)', borderRadius: 16 }}>

        {step !== 'pending' && (
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <HeartOutlined style={{ fontSize: 40, color: '#1677ff', marginBottom: 8 }} />
            <Title level={3} style={{ margin: 0 }}>HealthPlus</Title>
            <Text type="secondary">Your personal health platform</Text>
          </div>
        )}

        {/* Step 1 — Phone */}
        {step === 'phone' && (
          <Form layout="vertical" onFinish={handleSendOtp}>
            <Form.Item
              label="Phone Number"
              name="phone"
              rules={[
                { required: true, message: 'Enter your phone number' },
                { pattern: /^\+?[1-9]\d{9,14}$/, message: 'Include country code, e.g. +919876543210' },
              ]}
            >
              <Input prefix={<MobileOutlined />} placeholder="+919876543210" size="large" />
            </Form.Item>

            <div style={{ marginBottom: 16 }}>
              <Text style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Send OTP via</Text>
              <Segmented
                block
                value={channel}
                onChange={(v) => setChannel(v as 'sms' | 'whatsapp')}
                options={[
                  {
                    label: (
                      <div style={{ padding: '4px 0' }}>
                        <MessageOutlined style={{ marginRight: 6 }} />SMS
                      </div>
                    ),
                    value: 'sms',
                  },
                  {
                    label: (
                      <div style={{ padding: '4px 0' }}>
                        <WhatsAppOutlined style={{ marginRight: 6 }} />WhatsApp
                      </div>
                    ),
                    value: 'whatsapp',
                  },
                ]}
              />
            </div>

            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              Send OTP
            </Button>
          </Form>
        )}

        {/* Step 2 — OTP + role (role only matters for new users, existing users are redirected by stored role) */}
        {step === 'otp' && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">OTP sent via {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} to </Text>
              <Text strong>{phone}</Text>
              <Button type="link" size="small" onClick={() => setStep('phone')} style={{ padding: '0 4px' }}>
                Change
              </Button>
            </div>

            <Form layout="vertical" onFinish={handleVerifyOtp}>
              <Form.Item
                label="Enter OTP"
                name="code"
                rules={[
                  { required: true, message: 'Enter the OTP' },
                  { len: 6, message: 'OTP must be 6 digits' },
                ]}
              >
                <Input prefix={<LockOutlined />} placeholder="123456" maxLength={6} size="large" />
              </Form.Item>

              <Divider style={{ margin: '12px 0' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Registering for the first time?</Text>
              </Divider>

              <div style={{ marginBottom: 16 }}>
                <Text style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>I am joining as a</Text>
                <Segmented
                  block
                  value={roleChoice}
                  onChange={(v) => setRoleChoice(v as 'patient' | 'doctor')}
                  options={[
                    {
                      label: (
                        <div style={{ padding: '4px 0' }}>
                          <UserOutlined style={{ marginRight: 6 }} />Patient
                        </div>
                      ),
                      value: 'patient',
                    },
                    {
                      label: (
                        <div style={{ padding: '4px 0' }}>
                          <MedicineBoxOutlined style={{ marginRight: 6 }} />Doctor
                        </div>
                      ),
                      value: 'doctor',
                    },
                  ]}
                />
                <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                  Already have an account? Just enter your OTP — this is ignored.
                </Text>
              </div>

              <Space orientation="vertical" style={{ width: '100%' }}>
                <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                  Verify & Continue
                </Button>
                <Button block onClick={() => setStep('phone')} disabled={loading}>Back</Button>
              </Space>
            </Form>
          </>
        )}

        {/* Step 3 — Doctor self-registration */}
        {step === 'doctor-register' && (
          <>
            <Title level={5} style={{ marginBottom: 4 }}>Doctor Registration</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 12 }}>
              Fill in your details. Admin will review and approve your profile before you go live.
            </Text>
            <Form layout="vertical" onFinish={handleDoctorRegister}>
              <Form.Item label="Full Name" name="fullName" rules={[{ required: true, message: 'Required' }]}>
                <Input prefix={<UserOutlined />} placeholder="Dr. John Smith" />
              </Form.Item>
              <Form.Item label="Specialty" name="specialty" rules={[{ required: true, message: 'Required' }]}>
                <Select placeholder="Select your specialty" showSearch>
                  {specialties.map((s) => <Option key={s} value={s}>{s}</Option>)}
                </Select>
              </Form.Item>
              <Form.Item label="Medical License Number" name="licenseNumber" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="e.g. MCI-12345" />
              </Form.Item>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <Form.Item label="Years of Experience" name="yearsOfExperience">
                  <InputNumber min={0} max={60} style={{ width: '100%' }} placeholder="e.g. 5" />
                </Form.Item>
                <Form.Item label="Consultation Fee (₹)" name="consultationFee">
                  <InputNumber min={0} style={{ width: '100%' }} placeholder="e.g. 500" />
                </Form.Item>
              </div>
              <Form.Item label="Languages" name="languages">
                <Select mode="multiple" placeholder="Languages you consult in">
                  {languages.map((l) => <Option key={l} value={l}>{l}</Option>)}
                </Select>
              </Form.Item>
              <Form.Item label="Brief Bio" name="bio">
                <Input.TextArea rows={2} placeholder="Short professional bio..." showCount maxLength={300} />
              </Form.Item>

              <Divider style={{ margin: '12px 0' }}>Documents</Divider>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                Upload your medical license, degree certificates, and ID proof. These will be reviewed by admin.
              </Text>

              {['medical_license', 'degree_certificate', 'id_proof'].map((docType) => (
                <Form.Item
                  key={docType}
                  label={docType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                >
                  <Upload
                    name="file"
                    action={`${env.API_URL}/api/doctor/documents`}
                    headers={{ Authorization: `Bearer ${getToken()}` }}
                    data={{ documentType: docType }}
                    accept=".pdf,.jpg,.jpeg,.png"
                    maxCount={1}
                    onChange={({ file }) => {
                      if (file.status === 'done') message.success(`${file.name} uploaded`);
                      else if (file.status === 'error') message.error(`${file.name} upload failed`);
                    }}
                  >
                    <Button icon={<UploadOutlined />}>Upload {docType.replace(/_/g, ' ')}</Button>
                  </Upload>
                </Form.Item>
              ))}

              <Space orientation="vertical" style={{ width: '100%', marginTop: 8 }}>
                <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                  Submit for Approval
                </Button>
                <Button block onClick={() => setStep('otp')} disabled={loading}>Back</Button>
              </Space>
            </Form>
          </>
        )}

        {/* Step 4 — After new doctor submits registration */}
        {step === 'pending' && (
          <Result
            icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            title="Registration Submitted!"
            subTitle="Your doctor profile has been submitted for review. Admin will approve it shortly. You'll receive access once approved."
            extra={
              <Button type="primary" onClick={() => { setStep('phone'); setRoleChoice('patient'); }}>
                Back to Login
              </Button>
            }
          />
        )}

        {/* Existing doctor — not yet approved */}
        {step === 'awaiting-approval' && (
          <Result
            status="info"
            title="Approval Pending"
            subTitle="Your doctor profile is currently under review by our admin team. You'll be able to access your dashboard once approved. Please check back later."
            extra={
              <Button onClick={() => { setStep('phone'); setRoleChoice('patient'); }}>
                Back to Login
              </Button>
            }
          />
        )}

      </Card>
    </div>
  );
}
