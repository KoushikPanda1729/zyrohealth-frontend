'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Tabs, Table, Button, Modal, Form, Input, Select, Space,
  Typography, message, Popconfirm, Tag,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, MedicineBoxOutlined, ExperimentOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { apiCall } from '../../../lib/api';

const { Title } = Typography;
const { Option } = Select;

interface Medicine {
  id: string;
  name: string;
  genericName?: string;
  category?: string;
  defaultDosage?: string;
  defaultFrequency?: string;
  defaultDuration?: string;
  defaultRoute?: string;
  notes?: string;
}

interface Test {
  id: string;
  name: string;
  category?: string;
  description?: string;
  defaultInstructions?: string;
}

const ROUTES = ['oral', 'topical', 'intravenous', 'intramuscular', 'subcutaneous', 'inhaled', 'sublingual'];
const FREQUENCIES = ['once daily', 'twice daily', 'thrice daily', 'every 4 hours', 'every 6 hours', 'every 8 hours', 'every 12 hours', 'as needed', 'at bedtime'];

export default function LibraryPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [loadingMed, setLoadingMed] = useState(true);
  const [loadingTest, setLoadingTest] = useState(true);
  const [medModal, setMedModal] = useState<{ open: boolean; editing: Medicine | null }>({ open: false, editing: null });
  const [testModal, setTestModal] = useState<{ open: boolean; editing: Test | null }>({ open: false, editing: null });
  const [saving, setSaving] = useState(false);
  const [medForm] = Form.useForm();
  const [testForm] = Form.useForm();

  const fetchMedicines = useCallback(async () => {
    setLoadingMed(true);
    try {
      const res = await apiCall('GET', '/api/doctor/medicines');
      setMedicines(res.data || res || []);
    } catch { setMedicines([]); }
    finally { setLoadingMed(false); }
  }, []);

  const fetchTests = useCallback(async () => {
    setLoadingTest(true);
    try {
      const res = await apiCall('GET', '/api/doctor/tests');
      setTests(res.data || res || []);
    } catch { setTests([]); }
    finally { setLoadingTest(false); }
  }, []);

  useEffect(() => { fetchMedicines(); fetchTests(); }, [fetchMedicines, fetchTests]);

  const openMedModal = (med?: Medicine) => {
    setMedModal({ open: true, editing: med ?? null });
    medForm.setFieldsValue(med ?? { name: '', genericName: '', category: '', defaultDosage: '', defaultFrequency: '', defaultDuration: '', defaultRoute: 'oral', notes: '' });
  };
  const closeMedModal = () => { setMedModal({ open: false, editing: null }); medForm.resetFields(); };

  const openTestModal = (test?: Test) => {
    setTestModal({ open: true, editing: test ?? null });
    testForm.setFieldsValue(test ?? { name: '', category: '', description: '', defaultInstructions: '' });
  };
  const closeTestModal = () => { setTestModal({ open: false, editing: null }); testForm.resetFields(); };

  const saveMedicine = async (values: Omit<Medicine, 'id'>) => {
    setSaving(true);
    try {
      if (medModal.editing) {
        await apiCall('PUT', `/api/doctor/medicines/${medModal.editing.id}`, values);
        message.success('Medicine updated');
      } else {
        await apiCall('POST', '/api/doctor/medicines', values);
        message.success('Medicine added');
      }
      closeMedModal();
      fetchMedicines();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) message.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const deleteMedicine = async (id: string) => {
    try {
      await apiCall('DELETE', `/api/doctor/medicines/${id}`);
      message.success('Removed');
      fetchMedicines();
    } catch { message.error('Failed to delete'); }
  };

  const saveTest = async (values: Omit<Test, 'id'>) => {
    setSaving(true);
    try {
      if (testModal.editing) {
        await apiCall('PUT', `/api/doctor/tests/${testModal.editing.id}`, values);
        message.success('Test updated');
      } else {
        await apiCall('POST', '/api/doctor/tests', values);
        message.success('Test added');
      }
      closeTestModal();
      fetchTests();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) message.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const deleteTest = async (id: string) => {
    try {
      await apiCall('DELETE', `/api/doctor/tests/${id}`);
      message.success('Removed');
      fetchTests();
    } catch { message.error('Failed to delete'); }
  };

  const medColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (v: string) => <strong>{v}</strong> },
    { title: 'Generic', dataIndex: 'genericName', key: 'genericName', render: (v?: string) => v || '—' },
    { title: 'Category', dataIndex: 'category', key: 'category', render: (v?: string) => v ? <Tag>{v}</Tag> : '—' },
    { title: 'Dosage', dataIndex: 'defaultDosage', key: 'defaultDosage', render: (v?: string) => v || '—' },
    { title: 'Frequency', dataIndex: 'defaultFrequency', key: 'defaultFrequency', render: (v?: string) => v || '—' },
    { title: 'Duration', dataIndex: 'defaultDuration', key: 'defaultDuration', render: (v?: string) => v || '—' },
    { title: 'Route', dataIndex: 'defaultRoute', key: 'defaultRoute', render: (v?: string) => v || '—' },
    {
      title: 'Actions', key: 'actions',
      render: (_: unknown, rec: Medicine) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openMedModal(rec)} />
          <Popconfirm title="Remove this medicine?" onConfirm={() => void deleteMedicine(rec.id)} okText="Yes" cancelText="No">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const testColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (v: string) => <strong>{v}</strong> },
    { title: 'Category', dataIndex: 'category', key: 'category', render: (v?: string) => v ? <Tag color="blue">{v}</Tag> : '—' },
    { title: 'Description', dataIndex: 'description', key: 'description', render: (v?: string) => v || '—' },
    { title: 'Default Instructions', dataIndex: 'defaultInstructions', key: 'defaultInstructions', render: (v?: string) => v || '—' },
    {
      title: 'Actions', key: 'actions',
      render: (_: unknown, rec: Test) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openTestModal(rec)} />
          <Popconfirm title="Remove this test?" onConfirm={() => void deleteTest(rec.id)} okText="Yes" cancelText="No">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'medicines',
      label: <span><MedicineBoxOutlined /> Medicines ({medicines.length})</span>,
      children: (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openMedModal()}>Add Medicine</Button>
          </div>
          <Table
            columns={medColumns}
            dataSource={medicines.map((m) => ({ ...m, key: m.id }))}
            loading={loadingMed}
            size="middle"
            bordered
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 20 }}
          />
        </div>
      ),
    },
    {
      key: 'tests',
      label: <span><ExperimentOutlined /> Tests ({tests.length})</span>,
      children: (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openTestModal()}>Add Test</Button>
          </div>
          <Table
            columns={testColumns}
            dataSource={tests.map((t) => ({ ...t, key: t.id }))}
            loading={loadingTest}
            size="middle"
            bordered
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 20 }}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 20 }}>My Library</Title>
      <Tabs items={tabItems} />

      {/* Medicine modal */}
      <Modal
        title={medModal.editing ? 'Edit Medicine' : 'Add Medicine'}
        open={medModal.open}
        onCancel={closeMedModal}
        footer={null}
        width={560}
        destroyOnHidden
      >
        <Form form={medForm} layout="vertical" onFinish={saveMedicine} style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0 12px' }}>
            <Form.Item name="name" label="Medicine Name" rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder="e.g. Paracetamol" />
            </Form.Item>
            <Form.Item name="genericName" label="Generic Name">
              <Input placeholder="e.g. Acetaminophen" />
            </Form.Item>
            <Form.Item name="category" label="Category">
              <Input placeholder="e.g. Analgesic, Antibiotic" />
            </Form.Item>
            <Form.Item name="defaultDosage" label="Default Dosage">
              <Input placeholder="e.g. 500mg" />
            </Form.Item>
            <Form.Item name="defaultFrequency" label="Default Frequency">
              <Select placeholder="Select frequency" allowClear>
                {FREQUENCIES.map((f) => <Option key={f} value={f}>{f}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="defaultDuration" label="Default Duration">
              <Input placeholder="e.g. 5 days" />
            </Form.Item>
            <Form.Item name="defaultRoute" label="Default Route">
              <Select placeholder="Select route" allowClear>
                {ROUTES.map((r) => <Option key={r} value={r}>{r}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="notes" label="Default Notes">
              <Input placeholder="e.g. Take after meals" />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={closeMedModal}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Save</Button>
          </div>
        </Form>
      </Modal>

      {/* Test modal */}
      <Modal
        title={testModal.editing ? 'Edit Test' : 'Add Test'}
        open={testModal.open}
        onCancel={closeTestModal}
        footer={null}
        width={480}
        destroyOnHidden
      >
        <Form form={testForm} layout="vertical" onFinish={saveTest} style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Test Name" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. Complete Blood Count (CBC)" />
          </Form.Item>
          <Form.Item name="category" label="Category">
            <Input placeholder="e.g. Haematology, Biochemistry" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input placeholder="Brief description" />
          </Form.Item>
          <Form.Item name="defaultInstructions" label="Default Instructions">
            <Input.TextArea rows={2} placeholder="e.g. Fasting required for 8 hours" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={closeTestModal}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Save</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
