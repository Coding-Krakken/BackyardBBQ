'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Card,
  Select,
  SelectItem,
  TextInput,
  Textarea,
  Button,
  Callout,
} from '@tremor/react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RoleGate } from '@/components/RoleGate';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
}

const NOTIFICATION_TYPES = [
  'order_update',
  'booking_update',
  'payment_update',
  'referral_reward',
  'promotional',
];

export default function NotificationsPage() {
  const [target, setTarget] = useState<'all' | 'specific'>('all');
  const [customerId, setCustomerId] = useState('');
  const [type, setType] = useState('promotional');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: recentData, mutate } = useSWR<{ data: Notification[] }>(
    '/api/admin/notifications?limit=20',
    fetcher
  );

  const handleSend = async () => {
    setIsSending(true);
    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target,
          customerId: target === 'specific' ? customerId : undefined,
          type,
          title,
          message,
        }),
      });

      if (response.ok) {
        await mutate();
        setTitle('');
        setMessage('');
        setCustomerId('');
        setShowConfirm(false);
      }
    } catch (error) {
      console.error('Failed to send notification:', error);
    } finally {
      setIsSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const canSend = title.trim() && message.trim() && (target === 'all' || customerId.trim());

  return (
    <RoleGate allowedRoles={['owner', 'admin']}>
    <div className="p-6">
      <PageHeader
        title="Notifications"
        subtitle="Send notifications to customers"
      />

      {/* Compose Form */}
      <Card className="mb-8">
        <h3 className="mb-4 text-lg font-semibold text-bbq-light">Compose Notification</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Target</label>
              <Select value={target} onValueChange={(val) => setTarget(val as 'all' | 'specific')}>
                <SelectItem value="all">All Customers</SelectItem>
                <SelectItem value="specific">Specific Customer</SelectItem>
              </Select>
            </div>
            {target === 'specific' && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">Customer ID</label>
                <TextInput
                  placeholder="Enter customer ID..."
                  value={customerId}
                  onValueChange={setCustomerId}
                />
              </div>
            )}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Type</label>
              <Select value={type} onValueChange={setType}>
                {NOTIFICATION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replace('_', ' ').toUpperCase()}
                  </SelectItem>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Title</label>
            <TextInput
              placeholder="Enter notification title..."
              value={title}
              onValueChange={setTitle}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Message</label>
            <Textarea
              placeholder="Enter notification message..."
              value={message}
              onValueChange={setMessage}
              rows={4}
            />
          </div>
        </div>

        {/* Preview */}
        {title && message && (
          <div className="mt-6">
            <p className="mb-2 text-sm font-medium text-gray-300">Preview</p>
            <Callout title={title} color="blue">
              {message}
            </Callout>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button
            size="lg"
            color="orange"
            onClick={() => setShowConfirm(true)}
            disabled={!canSend}
          >
            Send Notification
          </Button>
        </div>
      </Card>

      {/* Recent Notifications */}
      <Card>
        <h3 className="mb-4 text-lg font-semibold text-bbq-light">Recent Notifications</h3>
        <DataTable
          columns={[
            { header: 'Title', accessor: (row: Notification) => row.title },
            {
              header: 'Type',
              accessor: (row: Notification) => row.type.replace('_', ' ').toUpperCase(),
            },
            {
              header: 'Message',
              accessor: (row: Notification) =>
                row.message.length > 50 ? row.message.slice(0, 50) + '...' : row.message,
            },
            { header: 'Sent', accessor: (row: Notification) => formatDate(row.createdAt) },
          ]}
          data={recentData?.data ?? []}
        />
      </Card>

      {/* Send Confirmation */}
      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSend}
        title="Send Notification"
        message={`Are you sure you want to send this notification to ${
          target === 'all' ? 'all customers' : 'the specified customer'
        }?`}
        confirmText="Send"
        isLoading={isSending}
      />
    </div>
    </RoleGate>
  );
}
