'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Button, Card, Tag, Modal, Form, Input, Select, Drawer,
  Tabs, Switch, Dropdown, Typography, Empty, Spin, message, Space, Divider,
} from 'antd';
import {
  PhoneOutlined, PlusOutlined, UserAddOutlined, DeleteOutlined,
  MoreOutlined, EditOutlined, UserDeleteOutlined, PhoneFilled,
} from '@ant-design/icons';
import { apiCall } from '../../../lib/api';

const { Title, Text } = Typography;

type Agent = { id: string; name: string; displayName: string };
type PhoneNumber = {
  id: string;
  phoneNumber: string;
  label?: string;
  provider?: string;
  inboundTrunkId?: string;
  outboundTrunkId?: string;
  assignedAgentId?: string;
  assignedAgent?: Agent | null;
};

const PROVIDERS = ['twilio', 'vonage', 'bandwidth', 'other'];
const TRANSPORTS = ['auto', 'tls', 'tcp', 'udp'];

export default function PhoneNumberPage() {
  const [phones, setPhones] = useState<PhoneNumber[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  // Import drawer
  const [importOpen, setImportOpen] = useState(false);
  const [importTab, setImportTab] = useState<'inbound' | 'outbound'>('inbound');
  const [importLoading, setImportLoading] = useState(false);
  const [inboundForm] = Form.useForm();
  const [outboundForm] = Form.useForm();
  const [selectedPhoneForOutbound, setSelectedPhoneForOutbound] = useState<PhoneNumber | null>(null);

  // Assign agent modal
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<PhoneNumber | null>(null);
  const [assignAgentId, setAssignAgentId] = useState<string>('');
  const [assignLoading, setAssignLoading] = useState(false);

  // Outbound call modal
  const [callOpen, setCallOpen] = useState(false);
  const [callTarget, setCallTarget] = useState<PhoneNumber | null>(null);
  const [callForm] = Form.useForm();
  const [callLoading, setCallLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [phonesRes, agentsRes] = await Promise.all([
        apiCall('GET', '/api/doctor/phone-numbers'),
        apiCall('GET', '/api/doctor/phone-numbers/agents'),
      ]);
      setPhones((phonesRes.data ?? phonesRes) as PhoneNumber[]);
      setAgents((agentsRes.data ?? agentsRes) as Agent[]);
    } catch {
      message.error('Failed to load phone numbers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleImportInbound = async (values: Record<string, string>) => {
    setImportLoading(true);
    try {
      await apiCall('POST', '/api/doctor/phone-numbers/inbound', {
        label: values['label'],
        phoneNumber: values['phoneNumber'],
        provider: values['provider'] ?? 'twilio',
      });
      message.success('Inbound trunk imported successfully');
      setImportOpen(false);
      inboundForm.resetFields();
      load();
    } catch (e: any) {
      message.error(e?.message ?? 'Failed to import inbound trunk');
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportOutbound = async (values: Record<string, string>) => {
    if (!selectedPhoneForOutbound) return;
    setImportLoading(true);
    try {
      await apiCall('POST', '/api/doctor/phone-numbers/outbound', {
        phoneNumberId: selectedPhoneForOutbound.id,
        address: values['address'],
        transport: values['transport'] ?? 'auto',
        username: values['username'],
        password: values['password'],
      });
      message.success('Outbound trunk configured successfully');
      setImportOpen(false);
      setSelectedPhoneForOutbound(null);
      outboundForm.resetFields();
      load();
    } catch (e: any) {
      message.error(e?.message ?? 'Failed to configure outbound trunk');
    } finally {
      setImportLoading(false);
    }
  };

  const handleAssignAgent = async () => {
    if (!assignTarget || !assignAgentId) return;
    setAssignLoading(true);
    try {
      await apiCall('PUT', `/api/doctor/phone-numbers/${assignTarget.id}/agent`, { agentId: assignAgentId });
      message.success('Agent assigned');
      setAssignOpen(false);
      setAssignTarget(null);
      setAssignAgentId('');
      load();
    } catch (e: any) {
      message.error(e?.message ?? 'Failed to assign agent');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleUnassignAgent = async (phone: PhoneNumber) => {
    Modal.confirm({
      title: 'Unassign Agent',
      content: `Remove the assigned agent from ${phone.phoneNumber}?`,
      okText: 'Unassign',
      okType: 'danger',
      onOk: async () => {
        await apiCall('DELETE', `/api/doctor/phone-numbers/${phone.id}/agent`);
        message.success('Agent unassigned');
        load();
      },
    });
  };

  const handleDelete = async (phone: PhoneNumber) => {
    Modal.confirm({
      title: 'Delete Phone Number',
      content: `Delete ${phone.phoneNumber}? This will also remove the LiveKit SIP trunk(s).`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        await apiCall('DELETE', `/api/doctor/phone-numbers/${phone.id}`);
        message.success('Phone number deleted');
        load();
      },
    });
  };

  const handleInitiateCall = async (values: Record<string, string>) => {
    if (!callTarget) return;
    setCallLoading(true);
    try {
      await apiCall('POST', `/api/doctor/phone-numbers/${callTarget.id}/call`, {
        toNumber: values['toNumber'],
        waitUntilAnswered: true,
      });
      message.success('Outbound call initiated');
      setCallOpen(false);
      callForm.resetFields();
    } catch (e: any) {
      message.error(e?.message ?? 'Failed to initiate call');
    } finally {
      setCallLoading(false);
    }
  };

  const openOutboundConfig = (phone: PhoneNumber) => {
    setSelectedPhoneForOutbound(phone);
    setImportTab('outbound');
    setImportOpen(true);
  };

  const getMenuItems = (phone: PhoneNumber) => [
    {
      key: 'inbound-config',
      label: 'Inbound Configuration',
      icon: <EditOutlined />,
      onClick: () => { setImportTab('inbound'); setImportOpen(true); },
    },
    {
      key: 'outbound-config',
      label: 'Outbound Configuration',
      icon: <EditOutlined />,
      onClick: () => openOutboundConfig(phone),
    },
    { type: 'divider' as const },
    ...(phone.assignedAgent ? [{
      key: 'unassign',
      label: 'Unassign Agent',
      icon: <UserDeleteOutlined />,
      danger: true,
      onClick: () => handleUnassignAgent(phone),
    }] : []),
    {
      key: 'delete',
      label: 'Delete',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => handleDelete(phone),
    },
  ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Phone Numbers</Title>
          <Text type="secondary">Manage your SIP Trunk phone number and voice agent settings.</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setImportTab('inbound'); setImportOpen(true); }}>
          Import from SIP Trunk
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : phones.length === 0 ? (
        <Card>
          <Empty
            image={<PhoneOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
            description={<Text type="secondary">No phone numbers yet. Import a SIP trunk to get started.</Text>}
          />
        </Card>
      ) : (
        <Space orientation="vertical" style={{ width: '100%' }} size={12}>
          {phones.map((phone) => (
            <Card key={phone.id} style={{ borderRadius: 10 }} bodyStyle={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                {/* Left: icon + info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10, background: '#f0f5ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <PhoneFilled style={{ fontSize: 20, color: '#1677ff' }} />
                  </div>
                  <div>
                    <Text strong style={{ fontSize: 15 }}>{phone.label ?? phone.phoneNumber}</Text>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Text type="secondary" style={{ fontSize: 13 }}>Number: {phone.phoneNumber}</Text>
                      {phone.provider && (
                        <Text type="secondary" style={{ fontSize: 13 }}>· Provider: {phone.provider}</Text>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      {phone.inboundTrunkId && <Tag color="green" style={{ borderRadius: 20, margin: 0 }}>✓ Inbound</Tag>}
                      {phone.outboundTrunkId && <Tag color="green" style={{ borderRadius: 20, margin: 0 }}>✓ Outbound</Tag>}
                      {!phone.inboundTrunkId && <Tag color="default" style={{ borderRadius: 20, margin: 0 }}>No Inbound</Tag>}
                      {!phone.outboundTrunkId && <Tag color="default" style={{ borderRadius: 20, margin: 0 }}>No Outbound</Tag>}
                    </div>
                  </div>
                </div>

                {/* Right: agent + actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Assigned agent */}
                  <div style={{
                    background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8,
                    padding: '8px 14px', minWidth: 180,
                  }}>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>Assigned Agent</Text>
                    {phone.assignedAgent ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <PhoneOutlined style={{ color: '#1677ff', fontSize: 13 }} />
                        <Text style={{ fontSize: 13 }}>{phone.assignedAgent.displayName}</Text>
                      </div>
                    ) : (
                      <Text type="secondary" style={{ fontSize: 13 }}>No agent assigned</Text>
                    )}
                  </div>

                  <Button
                    size="small"
                    icon={<UserAddOutlined />}
                    onClick={() => {
                      setAssignTarget(phone);
                      setAssignAgentId(phone.assignedAgentId ?? '');
                      setAssignOpen(true);
                    }}
                  >
                    {phone.assignedAgent ? 'Change Agent' : 'Assign Agent'}
                  </Button>

                  {phone.outboundTrunkId && (
                    <Button
                      size="small"
                      type="primary"
                      icon={<PhoneOutlined />}
                      onClick={() => {
                        setCallTarget(phone);
                        setCallOpen(true);
                      }}
                    >
                      Initiate Call
                    </Button>
                  )}

                  <Dropdown menu={{ items: getMenuItems(phone) }} trigger={['click']} placement="bottomRight">
                    <Button size="small" icon={<MoreOutlined />} />
                  </Dropdown>
                </div>
              </div>
            </Card>
          ))}
        </Space>
      )}

      {/* ── Import from SIP Trunk drawer ── */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f0f5ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PhoneOutlined style={{ color: '#1677ff' }} />
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>Import phone number from SIP Trunk</div>
              <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 400 }}>Configure inbound and outbound SIP trunk settings</div>
            </div>
          </div>
        }
        open={importOpen}
        onClose={() => { setImportOpen(false); setSelectedPhoneForOutbound(null); }}
        styles={{ wrapper: { width: 480 } }}
        footer={null}
      >
        <Tabs
          activeKey={importTab}
          onChange={(k) => setImportTab(k as 'inbound' | 'outbound')}
          items={[
            {
              key: 'inbound',
              label: 'Inbound',
              children: (
                <Form form={inboundForm} layout="vertical" onFinish={handleImportInbound}>
                  <Form.Item label="Trunk name" name="label" rules={[{ required: true }]}>
                    <Input placeholder="Label for this phone number" />
                  </Form.Item>
                  <Form.Item label="Phone Number" name="phoneNumber" rules={[{ required: true }]}>
                    <Input placeholder="+44XXXXXXXXXX" />
                  </Form.Item>
                  <Form.Item label="Provider" name="provider" initialValue="twilio">
                    <Select options={PROVIDERS.map((p) => ({ label: p, value: p }))} />
                  </Form.Item>
                  <Divider orientation="left" style={{ fontSize: 13 }}>Inbound Configuration</Divider>
                  <Form.Item label="Allowed IP Addresses" name="allowedIp" extra="Leave empty to allow all IP addresses.">
                    <Input placeholder="0.0.0.0/0" />
                  </Form.Item>
                  <Form.Item label="Media encryption (SRTP)">
                    <Select defaultValue="disabled" options={[
                      { label: 'Media encryption disabled', value: 'disabled' },
                      { label: 'Required', value: 'required' },
                      { label: 'Optional', value: 'optional' },
                    ]} />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" block loading={importLoading} style={{ marginTop: 8 }}>
                    Import Inbound trunk
                  </Button>
                </Form>
              ),
            },
            {
              key: 'outbound',
              label: 'Outbound',
              children: (
                <Form form={outboundForm} layout="vertical" onFinish={handleImportOutbound}>
                  {!selectedPhoneForOutbound && (
                    <Form.Item label="Phone Number" name="phoneNumberId" rules={[{ required: true }]}>
                      <Select
                        placeholder="Select a phone number"
                        options={phones.map((p) => ({ label: `${p.label ?? p.phoneNumber} (${p.phoneNumber})`, value: p.id }))}
                        onChange={(id) => setSelectedPhoneForOutbound(phones.find((p) => p.id === id) ?? null)}
                      />
                    </Form.Item>
                  )}
                  {selectedPhoneForOutbound && (
                    <div style={{ marginBottom: 16, padding: '10px 14px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8 }}>
                      <Text strong>{selectedPhoneForOutbound.label}</Text>
                      <Text type="secondary" style={{ marginLeft: 8 }}>{selectedPhoneForOutbound.phoneNumber}</Text>
                    </div>
                  )}
                  <Divider orientation="left" style={{ fontSize: 13 }}>Outbound Configuration</Divider>
                  <Form.Item
                    label="Address"
                    name="address"
                    rules={[{ required: true }]}
                    extra="Hostname or IP the SIP INVITE is sent to."
                  >
                    <Input placeholder="e.g. 192.0.2.0" />
                  </Form.Item>
                  <Form.Item label="Transport" name="transport" initialValue="auto">
                    <Select options={TRANSPORTS.map((t) => ({ label: t.toUpperCase(), value: t }))} />
                  </Form.Item>
                  <Form.Item label="Media encryption (SRTP)">
                    <Select defaultValue="disabled" options={[
                      { label: 'Media encryption disabled', value: 'disabled' },
                      { label: 'Required', value: 'required' },
                      { label: 'Optional', value: 'optional' },
                    ]} />
                  </Form.Item>
                  <Divider orientation="left" style={{ fontSize: 13 }}>Authentication</Divider>
                  <Form.Item label="SIP Trunk Username" name="username">
                    <Input placeholder="Username" />
                  </Form.Item>
                  <Form.Item label="SIP Trunk Password" name="password">
                    <Input.Password placeholder="Password" />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" block loading={importLoading} style={{ marginTop: 8 }}>
                    Import Outbound trunk
                  </Button>
                </Form>
              ),
            },
          ]}
        />
      </Drawer>

      {/* ── Assign Agent modal ── */}
      <Modal
        open={assignOpen}
        onCancel={() => { setAssignOpen(false); setAssignTarget(null); }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f0f5ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PhoneOutlined style={{ color: '#1677ff' }} />
            </div>
            <span>Assign Agent</span>
          </div>
        }
        footer={[
          <Button key="cancel" onClick={() => setAssignOpen(false)}>Cancel</Button>,
          <Button key="assign" type="primary" loading={assignLoading} disabled={!assignAgentId} onClick={handleAssignAgent}>
            ✓ Assign Agent
          </Button>,
        ]}
      >
        {assignTarget && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Assign an agent to handle calls to this phone number</Text>
            <div style={{ marginTop: 4 }}>
              <Text strong>{assignTarget.label ?? assignTarget.phoneNumber}</Text>
              <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>· {assignTarget.phoneNumber}</Text>
            </div>
          </div>
        )}
        <div style={{ marginBottom: 8 }}>
          <Text strong style={{ fontSize: 13 }}>Agent</Text>
        </div>
        <Select
          style={{ width: '100%' }}
          placeholder="Select an agent"
          value={assignAgentId || undefined}
          onChange={setAssignAgentId}
          options={agents.map((a) => ({ label: a.displayName, value: a.id }))}
        />
      </Modal>

      {/* ── Initiate Outbound Call modal ── */}
      <Modal
        open={callOpen}
        onCancel={() => { setCallOpen(false); callForm.resetFields(); }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f0f5ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PhoneOutlined style={{ color: '#1677ff' }} />
            </div>
            <span>Outbound Call</span>
          </div>
        }
        footer={null}
      >
        <Form form={callForm} layout="vertical" onFinish={handleInitiateCall}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Enter a phone number to receive a call from one of your agents.
          </Text>
          <Form.Item name="toNumber" rules={[{ required: true, message: 'Phone number is required' }]}>
            <Input placeholder="Enter phone number (e.g., +448888888888)" size="large" />
          </Form.Item>
          <div style={{
            padding: '12px 16px', background: '#f0f5ff', border: '1px solid #d6e4ff',
            borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Switch defaultChecked size="small" />
            <div>
              <Text strong style={{ fontSize: 13 }}>Wait until answered</Text>
              <div><Text type="secondary" style={{ fontSize: 12 }}>The call request will wait until the recipient answers.</Text></div>
            </div>
          </div>
          <Button type="primary" htmlType="submit" block loading={callLoading} size="large">
            Outbound Call
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
