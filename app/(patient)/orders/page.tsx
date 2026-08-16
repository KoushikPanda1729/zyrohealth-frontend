'use client';

import React, { useEffect, useState } from 'react';
import { Card, Tag, Button, Typography, message, Spin, Empty, Steps, Popconfirm, Input } from 'antd';
import { ShoppingCartOutlined } from '@ant-design/icons';
import axios from 'axios';
import { apiCall } from '../../../lib/api';

const { Title, Text } = Typography;

type OrderStatus =
  | 'placed' | 'confirmed' | 'packed' | 'picked_up' | 'out_for_delivery' | 'delivered' | 'cancelled';

const STATUS_STEPS: OrderStatus[] = ['placed', 'confirmed', 'packed', 'picked_up', 'out_for_delivery', 'delivered'];

const STATUS_LABELS: Record<OrderStatus, string> = {
  placed: 'Placed',
  confirmed: 'Confirmed',
  packed: 'Packed',
  picked_up: 'Picked Up',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

interface OrderItem { name: string; genericName?: string; quantity: number; unitPriceCents: number; subtotalCents: number; }
interface MedicineOrder {
  id: string;
  items: OrderItem[];
  totalCents: number;
  status: OrderStatus;
  createdAt: string;
}

function formatCents(cents: number): string {
  return `₹${(cents / 100).toFixed(2)}`;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<MedicineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await apiCall('GET', '/api/medicine-orders?page=1&limit=50');
      const payload = res.data ?? res;
      setOrders(Array.isArray(payload) ? payload : payload.data || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const cancelOrder = async (id: string) => {
    setCancellingId(id);
    try {
      await apiCall('POST', `/api/medicine-orders/${id}/cancel`, { reason: reasonById[id] });
      message.success('Order cancelled');
      fetchOrders();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) message.error(err.response?.data?.message || 'Failed to cancel order');
      else message.error('An error occurred');
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 20 }}>
        <ShoppingCartOutlined /> My Orders
      </Title>

      {orders.length === 0 ? (
        <Empty description="No medicine orders yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        orders.map((order) => (
          <Card key={order.id} style={{ marginBottom: 16, borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <Text strong>{order.items.length} item{order.items.length !== 1 ? 's' : ''}</Text>
                <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                  {new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </Text>
              </div>
              <Text strong>{formatCents(order.totalCents)}</Text>
            </div>

            <ul style={{ marginBottom: 16 }}>
              {order.items.map((item, i) => (
                <li key={i}>
                  {item.name} {item.genericName ? `(${item.genericName})` : ''} × {item.quantity}
                </li>
              ))}
            </ul>

            {order.status === 'cancelled' ? (
              <Tag color="red">Cancelled</Tag>
            ) : (
              <Steps
                size="small"
                current={STATUS_STEPS.indexOf(order.status)}
                items={STATUS_STEPS.map((s) => ({ title: STATUS_LABELS[s] }))}
              />
            )}

            {(order.status === 'placed' || order.status === 'confirmed') && (
              <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Input
                  placeholder="Reason (optional)"
                  value={reasonById[order.id] ?? ''}
                  onChange={(e) => setReasonById((prev) => ({ ...prev, [order.id]: e.target.value }))}
                  style={{ maxWidth: 300, flex: '1 1 200px' }}
                />
                <Popconfirm title="Cancel this order?" onConfirm={() => cancelOrder(order.id)}>
                  <Button danger loading={cancellingId === order.id}>Cancel Order</Button>
                </Popconfirm>
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
