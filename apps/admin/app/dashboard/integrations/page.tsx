'use client';

import useSWR from 'swr';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { DataTable } from '@/components/DataTable';
import { RoleGate } from '@/components/RoleGate';
import { AnimatedPage } from '@/components/AnimatedPage';
import { useToast } from '@/components/Toast';
import { fetcher, formatDate } from '@/lib/utils';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latencyMs: number;
  lastCheck: string;
}

interface Alert {
  id: string;
  service: string;
  message: string;
  severity: string;
  createdAt: string;
  acknowledged: boolean;
}

interface DeadLetter {
  id: string;
  queue: string;
  payload: string;
  error: string;
  createdAt: string;
}

export default function IntegrationsPage() {
  const { addToast } = useToast();

  const { data: healthData } = useSWR<{ services: ServiceHealth[] }>(
    '/api/admin/integrations/health',
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: alertsData, mutate: mutateAlerts } = useSWR<{ data: Alert[] }>(
    '/api/admin/integrations/alerts',
    fetcher
  );

  const { data: dlqData, mutate: mutateDLQ } = useSWR<{ data: DeadLetter[] }>(
    '/api/admin/integrations/dead-letters',
    fetcher
  );

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/admin/integrations/alerts/${alertId}/acknowledge`, { method: 'POST' });
      if (response.ok) {
        addToast({ type: 'success', message: 'Alert acknowledged' });
        await mutateAlerts();
      }
    } catch {
      addToast({ type: 'error', message: 'Failed to acknowledge alert' });
    }
  };

  const retryDeadLetter = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/integrations/dead-letters/${id}/retry`, { method: 'POST' });
      if (response.ok) {
        addToast({ type: 'success', message: 'Message retried' });
        await mutateDLQ();
      }
    } catch {
      addToast({ type: 'error', message: 'Retry failed' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'badge-green';
      case 'degraded': return 'badge-amber';
      case 'down': return 'badge-red';
      default: return 'badge-gray';
    }
  };

  return (
    <RoleGate allowedRoles={['owner', 'admin']}>
      <AnimatedPage>
        <PageHeader title="Integrations" subtitle="Monitor third-party service health and queues" />

        {/* Service Health */}
        <div className="grid-cards grid-cards-3 mb-xl">
          {(healthData?.services ?? []).length === 0 ? (
            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <div className="empty-state">
                <div className="empty-state-icon">🔌</div>
                <p>No services configured</p>
              </div>
            </div>
          ) : (
            (healthData?.services ?? []).map((service) => (
              <div key={service.name} className="card">
                <div className="flex-between mb-sm">
                  <h4>{service.name}</h4>
                  <span className={`badge ${getStatusColor(service.status)}`}>{service.status}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                  <div>
                    <div className="eyebrow">Latency</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-display)', color: service.latencyMs > 500 ? 'var(--warning)' : service.latencyMs > 1000 ? 'var(--danger)' : 'var(--cream)' }}>
                      {service.latencyMs}ms
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="eyebrow">Last Check</div>
                    <div className="text-muted" style={{ fontSize: '0.78rem' }}>{formatDate(service.lastCheck)}</div>
                  </div>
                </div>
                {/* Latency bar indicator */}
                <div style={{ marginTop: '0.65rem', height: '3px', background: 'var(--line-soft)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, (service.latencyMs / 1000) * 100)}%`,
                    background: service.latencyMs > 1000 ? 'var(--danger)' : service.latencyMs > 500 ? 'var(--warning)' : 'var(--success)',
                    borderRadius: '2px',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Alerts */}
        <div className="panel mb-lg">
          <h4 className="mb-md">Active Alerts</h4>
          <DataTable
            columns={[
              { header: 'Service', accessor: (row: Alert) => row.service },
              { header: 'Message', accessor: (row: Alert) => row.message },
              { header: 'Severity', accessor: (row: Alert) => <StatusBadge status={row.severity} /> },
              { header: 'Time', accessor: (row: Alert) => formatDate(row.createdAt) },
              { header: 'Actions', accessor: (row: Alert) => (
                !row.acknowledged ? (
                  <button className="btn btn-secondary btn-xs" onClick={() => acknowledgeAlert(row.id)}>Acknowledge</button>
                ) : (
                  <span className="text-muted">Acknowledged</span>
                )
              )},
            ]}
            data={alertsData?.data ?? []}
          />
        </div>

        {/* Dead Letter Queue */}
        <div className="panel">
          <h4 className="mb-md">Dead Letter Queue</h4>
          <DataTable
            columns={[
              { header: 'ID', accessor: (row: DeadLetter) => row.id.slice(0, 8) },
              { header: 'Queue', accessor: (row: DeadLetter) => row.queue },
              { header: 'Error', accessor: (row: DeadLetter) => (
                <span style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                  {row.error}
                </span>
              )},
              { header: 'Time', accessor: (row: DeadLetter) => formatDate(row.createdAt) },
              { header: 'Actions', accessor: (row: DeadLetter) => (
                <button className="btn btn-ghost btn-xs" onClick={() => retryDeadLetter(row.id)}>Retry</button>
              )},
            ]}
            data={dlqData?.data ?? []}
          />
        </div>
      </AnimatedPage>
    </RoleGate>
  );
}
