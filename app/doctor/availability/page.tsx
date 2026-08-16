'use client';

import React, { useEffect, useState } from 'react';
import {
  Card, Table, Button, Form, Select, TimePicker, InputNumber, Modal,
  Typography, message, Popconfirm, Tag, Space,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import axios from 'axios';
import { apiCall } from '../../../lib/api';

const { Title } = Typography;
const { Option } = Select;

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const dayColor: Record<string, string> = {
  monday: 'blue', tuesday: 'cyan', wednesday: 'green',
  thursday: 'gold', friday: 'orange', saturday: 'volcano', sunday: 'red',
};

interface Availability {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
}

export default function AvailabilityPage() {
  const [slots, setSlots] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const res = await apiCall('GET', '/api/doctor/availability');
      setSlots(res.data || res || []);
    } catch {
      setSlots([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSlots(); }, []);

  const handleAdd = async (values: {
    dayOfWeek: string;
    time: [dayjs.Dayjs, dayjs.Dayjs];
    slotDurationMinutes: number;
  }) => {
    setSaving(true);
    try {
      await apiCall('POST', '/api/doctor/availability', {
        dayOfWeek: values.dayOfWeek,
        startTime: values.time[0].format('HH:mm'),
        endTime: values.time[1].format('HH:mm'),
        slotDurationMinutes: values.slotDurationMinutes,
      });
      message.success('Availability slot added');
      setModalOpen(false);
      form.resetFields();
      fetchSlots();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) message.error(err.response?.data?.message || 'Failed to add slot');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiCall('DELETE', `/api/doctor/availability/${id}`);
      message.success('Slot deleted');
      fetchSlots();
    } catch {
      message.error('Failed to delete slot');
    }
  };

  const columns = [
    {
      title: 'Day',
      dataIndex: 'dayOfWeek',
      key: 'day',
      render: (d: string) => <Tag color={dayColor[d]}>{d.charAt(0).toUpperCase() + d.slice(1)}</Tag>,
    },
    {
      title: 'Start Time',
      dataIndex: 'startTime',
      key: 'start',
    },
    {
      title: 'End Time',
      dataIndex: 'endTime',
      key: 'end',
    },
    {
      title: 'Slot Duration',
      dataIndex: 'slotDurationMinutes',
      key: 'duration',
      render: (v: number) => `${v} min`,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, r: Availability) => (
        <Popconfirm
          title="Delete this slot?"
          onConfirm={() => handleDelete(r.id)}
          okText="Delete"
          okButtonProps={{ danger: true }}
        >
          <Button danger size="small" icon={<DeleteOutlined />}>Delete</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>Manage Availability</Title>

      <Card
        style={{ borderRadius: 12 }}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Add Slot
          </Button>
        }
        title="Weekly Schedule"
      >
        <Table
          columns={columns}
          dataSource={slots.map((s) => ({ ...s, key: s.id }))}
          loading={loading}
          bordered
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={false}
        />
      </Card>

      <Modal
        title="Add Availability Slot"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleAdd}>
          <Form.Item
            label="Day of Week"
            name="dayOfWeek"
            rules={[{ required: true, message: 'Select a day' }]}
          >
            <Select placeholder="Select day">
              {DAYS.map((d) => (
                <Option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="Time Range"
            name="time"
            rules={[{ required: true, message: 'Select time range' }]}
          >
            <TimePicker.RangePicker format="HH:mm" minuteStep={15} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="Slot Duration (minutes)"
            name="slotDurationMinutes"
            initialValue={30}
          >
            <InputNumber min={10} max={120} step={5} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
