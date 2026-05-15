'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/PageHeader';
import { RoleGate } from '@/components/RoleGate';
import { AnimatedPage } from '@/components/AnimatedPage';
import { useToast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { fetcher, formatDate } from '@/lib/utils';

interface Notification {
  id: string;
  type: string;
  subject: string;
  recipientCount: number;
  sentAt: string;
  status: string;
}

export default function NotificationsPage() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('all');
  const [channel, setChannel] = useState('email');
  const [isSending, setIsSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { addToast } = useToast();

  const { data, mutate } = useSWR<{ data: Notification[] }>('/api/admin/notifications', fetcher);

  const handleSendClick = () => {
    if (!subject.trim() || !message.trim()) {
      addToast({ type: 'warning', message: 'Please fill in subject and message' });
      return;
    }
    setShowConfirm(true);
  };

  const handleSend = async () => {
    setIsSending(true);
    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message, audience, channel }),
      });
      if (response.ok) {
        addToast({ type: 'success', message: 'Notification sent successfully' });
        setSubject('');
        setMessage('');
        await mutate();
      } else {
        addToast({ type: 'error', message: 'Failed to send notification' });
      }
    } catch {
      addToast({ type: 'error', message: 'An error occurred' });
    } finally {
      setIsSending(false);
      setShowConfirm(false);
    }
  };

  return (
    <RoleGate allowedRoles={['owner', 'admin']}>
      <AnimatedPage>
        <PageHeader title="Notifications" subtitle="Send messages and view notification history" />

        {/* Compose */}
        <div className="panel mb-xl">
          <h4 className="mb-md">Compose Notification</h4>
          <div className="form-stack">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Audience</label>
                <select className="select" value={audience} onChange={(e) => setAudience(e.target.value)}>
                  <option value="all">All Customers</option>
                  <option value="active">Active Customers</option>
                  <option value="inactive">Inactive Customers</option>
                  <option value="staff">Staff Only</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Channel</label>
                <select className="select" value={channel} onChange={(e) => setChannel(e.target.value)}>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="push">Push Notification</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Subject</label>
              <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Notification subject" />
            </div>
            <div className="form-group">
              <label className="form-label">Message</label>
              <textarea className="textarea" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write your message..." rows={5} aria-label="Notification message" />
            </div>
            <div>
              <button className="btn btn-primary" onClick={handleSendClick} disabled={isSending}>
                {isSending ? 'Sending...' : 'Send Notification'}
              </button>
            </div>
          </div>
        </div>

        {/* Recent Notifications */}
        <div className="panel">
          <h4 className="mb-md">Recent Notifications</h4>
          {(data?.data ?? []).length === 0 ? (
            <p className="text-muted">No notifications sent yet</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Type</th>
                  <th>Recipients</th>
                  <th>Status</th>
                  <th>Sent</th>
                </tr>
              </thead>
              <tbody>
                {(data?.data ?? []).map((n) => (
                  <tr key={n.id}>
                    <td>{n.subject}</td>
                    <td>{n.type}</td>
                    <td>{n.recipientCount}</td>
                    <td><span className={`badge ${n.status === 'sent' ? 'badge-green' : 'badge-amber'}`}>{n.status}</span></td>
                    <td>{formatDate(n.sentAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <ConfirmDialog
          isOpen={showConfirm}
          onClose={() => setShowConfirm(false)}
          onConfirm={handleSend}
          title="Send Notification"
          message={`Send "${subject}" via ${channel} to ${audience === 'all' ? 'all customers' : audience + ' customers'}? This cannot be undone.`}
          confirmText="Send"
          variant="primary"
          isLoading={isSending}
        />
      </AnimatedPage>
    </RoleGate>
  );
}
