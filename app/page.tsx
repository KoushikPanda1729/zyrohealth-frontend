'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '../lib/auth';
import { Spin } from 'antd';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace('/login');
    } else if (user.role === 'doctor') {
      router.replace('/doctor/dashboard');
    } else {
      router.replace('/dashboard');
    }
  }, [router]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Spin size="large" />
    </div>
  );
}
