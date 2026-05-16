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
  channel: string;
  status: 'healthy' | 'degraded' | 'down';
  latencyMs: number;
  recordedAt: string;
  processedCount: number;
  failedCount: number;
  deadLetterCount: number;
}

interface Alert {
  channel: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
}

interface DeadLetter {
  id: string;
  channel: string;
  eventType: string;
  payload: {
    reason?: string;
    orderExternalId?: string;
    retriedAt?: string;
  };
  createdAt: string;
}

export default function IntegrationsPage() {
  const { addToast } = useToast();

  const { data: healthData } = useSWR<{ data: ServiceHealth[] }>(
    '/api/admin/integrations/health',
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: alertsData } = useSWR<{ alerts: Alert[] }>(
    '/api/admin/integrations/alerts',
    fetcher
  );

  const { data: dlqData, mutate: mutateDLQ } = useSWR<{ data: DeadLetter[] }>(
    '/api/admin/integrations/dead-letter',
    fetcher
  );

  const retryDeadLetter = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/integrations/dead-letter/${id}/retry`, { method: 'PATCH' });
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
          {(healthData?.data ?? []).length === 0 ? (
            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <div className="empty-state">
                <div className="empty-state-icon">🔌</div>
                <p>No services configured</p>
              </div>
            </div>
          ) : (
            (healthData?.data ?? []).map((service) => (
              <div key={service.channel} className="card">
                <div className="flex-between mb-sm">
                  <h4>{service.channel.toUpperCase()}</h4>
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
                    <div className="text-muted" style={{ fontSize: '0.78rem' }}>{formatDate(service.recordedAt)}</div>
                  </div>
                </div>
                <div style={{ marginTop: '0.65rem', fontSize: '0.78rem', color: 'var(--warm-gray)' }}>
                  {service.processedCount} processed / {service.failedCount} failed / {service.deadLetterCount} dead-letter
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
              { header: 'Service', accessor: (row: Alert) => row.channel.toUpperCase() },
              { header: 'Message', accessor: (row: Alert) => row.message },
              { header: 'Severity', accessor: (row: Alert) => <StatusBadge status={row.severity} /> },
              { header: 'Action', accessor: () => <span className="text-muted">Automatic</span> },
            ]}
            data={alertsData?.alerts ?? []}
          />
        </div>

        {/* Dead Letter Queue */}
        <div className="panel">
          <h4 className="mb-md">Dead Letter Queue</h4>
          <DataTable
            columns={[
              { header: 'ID', accessor: (row: DeadLetter) => row.id.slice(0, 8) },
              { header: 'Channel', accessor: (row: DeadLetter) => row.channel.toUpperCase() },
              { header: 'Event', accessor: (row: DeadLetter) => row.eventType },
              { header: 'Error', accessor: (row: DeadLetter) => (
                <span style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                  {row.payload.reason ?? 'Unknown error'}
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
