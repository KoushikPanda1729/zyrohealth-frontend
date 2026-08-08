'use client';

import React, { useEffect, useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography, Button } from 'antd';
import {
  DashboardOutlined, CalendarOutlined, FileTextOutlined,
  UserOutlined, LogoutOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, ScheduleOutlined, MedicineBoxOutlined,
  RobotOutlined, PhoneOutlined, MessageOutlined,
} from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import { getUser, getRefreshToken, clearAuth } from '../../lib/auth';
import { api } from '../../lib/api';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const navItems = [
  { key: '/doctor/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/doctor/appointments', icon: <CalendarOutlined />, label: 'Appointments' },
  { key: '/doctor/availability', icon: <ScheduleOutlined />, label: 'Availability' },
  { key: '/doctor/library', icon: <MedicineBoxOutlined />, label: 'My Library' },
  { key: '/doctor/prescriptions', icon: <FileTextOutlined />, label: 'Prescriptions' },
  { key: '/doctor/voice-agent', icon: <RobotOutlined />, label: 'Voice Agent' },
  { key: '/doctor/conversations', icon: <MessageOutlined />, label: 'Conversations' },
  { key: '/doctor/phone-number', icon: <PhoneOutlined />, label: 'Phone Number' },
  { key: '/doctor/profile', icon: <UserOutlined />, label: 'My Profile' },
];

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<{ fullName?: string; role?: string } | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.replace('/login'); return; }
    if (u.role !== 'doctor') { router.replace('/dashboard'); return; }
    setUser(u);
  }, [router]);

  const handleLogout = async () => {
    const refreshToken = getRefreshToken();
    clearAuth();
    if (refreshToken) {
      await api.post('/api/auth/logout', { refreshToken }).catch(() => {});
    }
    router.replace('/login');
  };

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: 'My Profile', onClick: () => router.push('/doctor/profile') },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', danger: true, onClick: handleLogout },
  ];

  const selectedKey = navItems.find((item) => pathname.startsWith(item.key))?.key || '/doctor/dashboard';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="light"
        style={{ boxShadow: '2px 0 8px rgba(0,0,0,0.08)', position: 'fixed', height: '100vh', left: 0, top: 0, zIndex: 100 }}
        width={220}
      >
        <div style={{ padding: collapsed ? '16px 8px' : '16px 20px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #f0f0f0' }}>
          {collapsed ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src="/logo-icon.png" alt="ZyroHealth" style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }} />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src="/logo-full.png" alt="ZyroHealth" style={{ height: 22, width: 'auto', display: 'block' }} />
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={navItems}
          style={{ border: 'none', marginTop: 8 }}
          onClick={({ key }) => router.push(key)}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 220, transition: 'margin-left 0.2s' }}>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          position: 'sticky',
          top: 0,
          zIndex: 99,
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} style={{ background: '#722ed1' }} />
              {user?.fullName && <Text>{user.fullName}</Text>}
            </div>
          </Dropdown>
        </Header>

        <Content style={{ padding: 24, background: '#f5f7fa', minHeight: 'calc(100vh - 64px)' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
