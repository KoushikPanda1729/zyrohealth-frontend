'use client';

import React, { useState } from 'react';
import {
  Form, Input, Button, Typography, message, Space,
  Segmented, InputNumber, Select, Result, Divider, Upload,
} from 'antd';
import {
  MobileOutlined, LockOutlined, HeartOutlined,
  UserOutlined, MedicineBoxOutlined, CheckCircleOutlined, UploadOutlined,
  MessageOutlined, WhatsAppOutlined, CalendarOutlined, FileTextOutlined,
  ShoppingOutlined, CheckCircleFilled,
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

const TRUST_BADGES = ['OTP via WhatsApp or SMS', 'Verified doctors', 'Home medicine delivery'];

const brandBackground = [
  'radial-gradient(circle at 18% 18%, rgba(45,212,191,0.55) 0%, rgba(45,212,191,0) 45%)',
  'radial-gradient(circle at 85% 12%, rgba(96,165,250,0.4) 0%, rgba(96,165,250,0) 50%)',
  'radial-gradient(circle at 25% 88%, rgba(52,211,153,0.45) 0%, rgba(52,211,153,0) 55%)',
  'linear-gradient(160deg, #063a3a 0%, #0b5f5a 45%, #04314f 100%)',
].join(', ');

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
    <div style={{ minHeight: '100vh', display: 'flex', background: '#ffffff' }}>
      {/* Left brand panel */}
      <div
        className="login-brand-panel"
        style={{
          flex: '0 0 46%',
          maxWidth: 620,
          minHeight: '100vh',
          position: 'relative',
          overflow: 'hidden',
          background: brandBackground,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 48px 40px',
          color: '#fff',
        }}
      >
        {/* dot-grid texture */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            maskImage: 'radial-gradient(circle at 50% 40%, #000 0%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(circle at 50% 40%, #000 0%, transparent 75%)',
            pointerEvents: 'none',
          }}
        />

        {/* Brand mark */}
        <div
          style={{
            position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center',
            background: '#fff', borderRadius: 10, padding: '7px 12px',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-full.png" alt="ZyroHealth" style={{ height: 22, width: 'auto', display: 'block' }} />
        </div>

        {/* Headline + floating mockup */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Title level={2} style={{ color: '#fff', maxWidth: 440, lineHeight: 1.25, marginBottom: 12 }}>
            Your care team, one tap away.
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 15, display: 'block', maxWidth: 400, marginBottom: 24 }}>
            Book doctors, order medicines, and manage prescriptions — over WhatsApp or right here.
          </Text>

          <Space direction="vertical" size={8} style={{ marginBottom: 40 }}>
            {TRUST_BADGES.map((badge) => (
              <div key={badge} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircleFilled style={{ color: '#5eead4', fontSize: 14 }} />
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>{badge}</Text>
              </div>
            ))}
          </Space>

          {/* Floating "appointment" mockup card */}
          <div
            className="login-float-slow"
            style={{
              position: 'relative',
              width: 300,
              borderRadius: 16,
              padding: 18,
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.22)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
              transform: 'rotate(-2deg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: 600 }}>Upcoming Appointment</Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span
                  style={{
                    width: 6, height: 6, borderRadius: '50%', background: '#4ade80',
                    boxShadow: '0 0 0 3px rgba(74,222,128,0.25)',
                  }}
                />
                <Text style={{ color: '#4ade80', fontSize: 11 }}>Today, 5:30 PM</Text>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div
                style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <UserOutlined style={{ color: '#fff', fontSize: 15 }} />
              </div>
              <div>
                <Text style={{ color: '#fff', fontSize: 13, display: 'block', fontWeight: 500 }}>Dr. Aisha Khan</Text>
                <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>Cardiologist</Text>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { icon: <CalendarOutlined />, label: 'Visits', value: '3' },
                { icon: <FileTextOutlined />, label: 'Rx', value: '12' },
                { icon: <ShoppingOutlined />, label: 'Orders', value: '5' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    borderRadius: 10,
                    padding: '8px 6px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginBottom: 4 }}>{stat.icon}</div>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: 600, display: 'block' }}>{stat.value}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10 }}>{stat.label}</Text>
                </div>
              ))}
            </div>
          </div>

          {/* Floating decorative badges */}
          <div
            className="login-float-fast"
            style={{
              position: 'absolute', top: -18, left: 260,
              width: 44, height: 44, borderRadius: '50%',
              background: '#25D366',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 10px 24px rgba(37,211,102,0.4)',
              transform: 'rotate(8deg)',
            }}
          >
            <WhatsAppOutlined style={{ color: '#fff', fontSize: 20 }} />
          </div>
          <div
            className="login-float-medium"
            style={{
              position: 'absolute', top: 60, left: -14,
              width: 46, height: 46, borderRadius: 12,
              background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.26)',
              backdropFilter: 'blur(10px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: 'rotate(-6deg)',
            }}
          >
            <MedicineBoxOutlined style={{ color: '#fff', fontSize: 20 }} />
          </div>
          <div
            className="login-float-fast2"
            style={{
              position: 'absolute', bottom: 30, right: -10,
              width: 40, height: 40, borderRadius: '50%',
              background: '#fb7185',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 10px 24px rgba(251,113,133,0.4)',
              transform: 'rotate(-8deg)',
            }}
          >
            <HeartOutlined style={{ color: '#fff', fontSize: 17 }} />
          </div>
        </div>

        <Text style={{ position: 'relative', zIndex: 1, color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
          Your personal health platform
        </Text>
      </div>

      {/* Right — form */}
      <div
        style={{
          flex: 1,
          minHeight: '100vh',
          maxHeight: '100vh',
          overflowY: 'auto',
          display: 'flex',
          justifyContent: 'center',
          padding: '48px 24px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 420, margin: 'auto' }}>

          {/* Compact brand — mobile only */}
          <div className="login-mobile-brand" style={{ display: 'none', alignItems: 'center', marginBottom: 28, justifyContent: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-full.png" alt="ZyroHealth" style={{ height: 28, width: 'auto', display: 'block' }} />
          </div>

          {/* Step 1 — Phone */}
          {step === 'phone' && (
            <>
              <Title level={3} style={{ marginBottom: 4 }}>Welcome back</Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: 28 }}>
                Enter your phone number to sign in or create an account.
              </Text>
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

                <div style={{ marginBottom: 20 }}>
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
            </>
          )}

          {/* Step 2 — OTP + role (role only matters for new users, existing users are redirected by stored role) */}
          {step === 'otp' && (
            <>
              <Title level={3} style={{ marginBottom: 4 }}>Verify your number</Title>
              <div style={{ marginBottom: 24 }}>
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

                <div style={{ marginBottom: 20 }}>
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
              <Title level={4} style={{ marginBottom: 4 }}>Doctor Registration</Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: 20, fontSize: 12 }}>
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

        </div>
      </div>

      <style>{`
        @keyframes loginFloatSlow {
          0%, 100% { transform: rotate(-2deg) translateY(0px); }
          50% { transform: rotate(-2deg) translateY(-10px); }
        }
        @keyframes loginFloatMedium {
          0%, 100% { transform: rotate(-6deg) translateY(0px); }
          50% { transform: rotate(-6deg) translateY(-8px); }
        }
        @keyframes loginFloatFast {
          0%, 100% { transform: rotate(8deg) translateY(0px); }
          50% { transform: rotate(8deg) translateY(-12px); }
        }
        @keyframes loginFloatFast2 {
          0%, 100% { transform: rotate(-8deg) translateY(0px); }
          50% { transform: rotate(-8deg) translateY(-12px); }
        }
        .login-float-slow { animation: loginFloatSlow 6s ease-in-out infinite; }
        .login-float-medium { animation: loginFloatMedium 5s ease-in-out infinite; }
        .login-float-fast { animation: loginFloatFast 4s ease-in-out infinite; }
        .login-float-fast2 { animation: loginFloatFast2 4.5s ease-in-out infinite; }

        @media (max-width: 900px) {
          .login-brand-panel { display: none; }
          .login-mobile-brand { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
