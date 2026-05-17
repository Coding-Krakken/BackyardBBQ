'use client';

import { useState } from 'react';
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
  queuedCount: number;
  dispatchQueuedCount: number;
  dispatchProcessedCount: number;
  actionQueuedCount: number;
  actionProcessedCount: number;
  actionDeadLetterCount: number;
  settlementQueuedCount: number;
  settlementProcessedCount: number;
  settlementNetCents: number;
}

interface Alert {
  channel: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  evidence?: {
    eventIds?: string[];
    settlementIds?: string[];
    correlationIds?: string[];
    apiPath?: string;
    artifactPath?: string;
    baselineApiPath?: string;
  };
}

interface DeadLetter {
  id: string;
  channel: string;
  eventType: string;
  payload: {
    reason?: string;
    orderExternalId?: string;
    correlationId?: string;
    retriedAt?: string;
  };
  createdAt: string;
}

interface SettlementEvent {
  id: string;
  channel: string;
  eventType: string;
  status: string;
  settlementId: string | null;
  payoutId: string | null;
  grossCents: number;
  feesCents: number;
  netCents: number;
  currency: string;
  settledAt: string;
  orderExternalId: string | null;
  correlationId: string | null;
  createdAt: string;
}

interface SettlementSummary {
  totalCount: number;
  processedCount: number;
  queuedCount: number;
  failedCount: number;
  grossCents: number;
  feesCents: number;
  netCents: number;
}

interface SettlementTrendRow {
  date: string;
  grossCents: number;
  feesCents: number;
  netCents: number;
  count: number;
  feeRatePercent: number;
}

export default function IntegrationsPage() {
  const { addToast } = useToast();
  const [settlementChannel, setSettlementChannel] = useState<'all' | 'doordash' | 'ubereats' | 'grubhub'>('all');
  const [settlementStatus, setSettlementStatus] = useState<'all' | 'processed' | 'queued' | 'pending' | 'ignored' | 'dead_letter' | 'failed'>('all');
  const [settlementLimit, setSettlementLimit] = useState(25);
  const [settlementCorrelationId, setSettlementCorrelationId] = useState('');
  const [settlementFromDate, setSettlementFromDate] = useState('');
  const [settlementToDate, setSettlementToDate] = useState('');

  const settlementQuery = new URLSearchParams();
  settlementQuery.set('limit', String(settlementLimit));
  if (settlementChannel !== 'all') {
    settlementQuery.set('channel', settlementChannel);
  }
  if (settlementStatus !== 'all') {
    settlementQuery.set('status', settlementStatus);
  }
  if (settlementCorrelationId.trim().length > 0) {
    settlementQuery.set('correlationId', settlementCorrelationId.trim());
  }
  if (settlementFromDate) {
    settlementQuery.set('from', settlementFromDate);
  }
  if (settlementToDate) {
    settlementQuery.set('to', settlementToDate);
  }

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

  const { data: settlementsData } = useSWR<{ summary: SettlementSummary; data: SettlementEvent[] }>(
    `/api/admin/integrations/settlements?${settlementQuery.toString()}`,
    fetcher
  );

  const { data: settlementTrendData } = useSWR<{ windowDays: number; data: SettlementTrendRow[] }>(
    `/api/admin/integrations/settlements/trend?days=14${settlementChannel !== 'all' ? `&channel=${settlementChannel}` : ''}`,
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
    <RoleGate allowedRoles={['owner', 'admin', 'accounting']}>
      <AnimatedPage>
        <PageHeader
          title="Integrations"
          subtitle="Monitor third-party service health and queues"
          action={(
            <a className="btn btn-ghost" href={`/api/admin/integrations/settlements/export?${settlementQuery.toString()}`}>
              Export Settlements CSV
            </a>
          )}
        />

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
                <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--warm-gray)' }}>
                  {service.queuedCount} queued / {service.dispatchQueuedCount} dispatch queued / {service.dispatchProcessedCount} dispatch processed
                </div>
                <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--warm-gray)' }}>
                  {service.actionQueuedCount} action queued / {service.actionProcessedCount} action processed / {service.actionDeadLetterCount} action dead-letter
                </div>
                <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--warm-gray)' }}>
                  {service.settlementQueuedCount} settlement queued / {service.settlementProcessedCount} settlement processed / ${(service.settlementNetCents / 100).toFixed(2)} settlement net
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
              {
                header: 'Action',
                accessor: (row: Alert) => (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: '220px' }}>
                    {row.evidence?.apiPath ? (
                      <a href={row.evidence.apiPath} className="text-muted" style={{ textDecoration: 'underline' }}>
                        View alert evidence
                      </a>
                    ) : (
                      <span className="text-muted">Automatic</span>
                    )}
                    {row.evidence?.baselineApiPath ? (
                      <a href={row.evidence.baselineApiPath} className="text-muted" style={{ textDecoration: 'underline' }}>
                        View baseline window
                      </a>
                    ) : null}
                    {row.evidence?.eventIds && row.evidence.eventIds.length > 0 ? (
                      <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                        Events: {row.evidence.eventIds.join(', ')}
                      </span>
                    ) : null}
                    {row.evidence?.settlementIds && row.evidence.settlementIds.length > 0 ? (
                      <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                        Settlements: {row.evidence.settlementIds.join(', ')}
                      </span>
                    ) : null}
                    {row.evidence?.correlationIds && row.evidence.correlationIds.length > 0 ? (
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                        Correlations:{' '}
                        {row.evidence.correlationIds.map((id, index) => (
                          <span key={id}>
                            <a href={`/api/admin/integrations/correlation/${encodeURIComponent(id)}`} style={{ textDecoration: 'underline' }}>
                              {id}
                            </a>
                            {index < row.evidence!.correlationIds!.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {row.evidence?.artifactPath ? (
                      <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                        Artifact: {row.evidence.artifactPath}
                      </span>
                    ) : null}
                  </div>
                )
              },
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
              {
                header: 'Correlation',
                accessor: (row: DeadLetter) =>
                  row.payload.correlationId ? (
                    <a href={`/api/admin/integrations/correlation/${encodeURIComponent(row.payload.correlationId)}`} style={{ textDecoration: 'underline' }}>
                      {row.payload.correlationId}
                    </a>
                  ) : '-'
              },
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

        <div className="panel mt-lg">
          <h4 className="mb-md">Recent Settlement Events</h4>
          <div className="grid-cards grid-cards-4 mb-md">
            <div className="card">
              <div className="eyebrow">Processed / Total</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>
                {settlementsData?.summary?.processedCount ?? 0} / {settlementsData?.summary?.totalCount ?? 0}
              </div>
            </div>
            <div className="card">
              <div className="eyebrow">Gross</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>${((settlementsData?.summary?.grossCents ?? 0) / 100).toFixed(2)}</div>
            </div>
            <div className="card">
              <div className="eyebrow">Fees</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>${((settlementsData?.summary?.feesCents ?? 0) / 100).toFixed(2)}</div>
            </div>
            <div className="card">
              <div className="eyebrow">Net</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>${((settlementsData?.summary?.netCents ?? 0) / 100).toFixed(2)}</div>
            </div>
          </div>
          <div className="form-row" style={{ marginBottom: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Channel</label>
              <select className="select" value={settlementChannel} onChange={(event) => setSettlementChannel(event.target.value as 'all' | 'doordash' | 'ubereats' | 'grubhub')}>
                <option value="all">All</option>
                <option value="doordash">DoorDash</option>
                <option value="ubereats">UberEats</option>
                <option value="grubhub">Grubhub</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="select" value={settlementStatus} onChange={(event) => setSettlementStatus(event.target.value as 'all' | 'processed' | 'queued' | 'pending' | 'ignored' | 'dead_letter' | 'failed')}>
                <option value="all">All</option>
                <option value="processed">Processed</option>
                <option value="queued">Queued</option>
                <option value="pending">Pending</option>
                <option value="ignored">Ignored</option>
                <option value="dead_letter">Dead letter</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Limit</label>
              <select className="select" value={settlementLimit} onChange={(event) => setSettlementLimit(Number(event.target.value))}>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">From</label>
              <input className="input" type="date" value={settlementFromDate} onChange={(event) => setSettlementFromDate(event.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Correlation ID</label>
              <input
                className="input"
                type="text"
                placeholder="dlv-doordash-..."
                value={settlementCorrelationId}
                onChange={(event) => setSettlementCorrelationId(event.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">To</label>
              <input className="input" type="date" value={settlementToDate} onChange={(event) => setSettlementToDate(event.target.value)} />
            </div>
          </div>
          <DataTable
            columns={[
              { header: 'Channel', accessor: (row: SettlementEvent) => row.channel.toUpperCase() },
              { header: 'Settlement ID', accessor: (row: SettlementEvent) => row.settlementId ?? '-' },
              { header: 'Payout ID', accessor: (row: SettlementEvent) => row.payoutId ?? '-' },
              {
                header: 'Correlation',
                accessor: (row: SettlementEvent) =>
                  row.correlationId ? (
                    <a href={`/api/admin/integrations/correlation/${encodeURIComponent(row.correlationId)}`} style={{ textDecoration: 'underline' }}>
                      {row.correlationId}
                    </a>
                  ) : '-'
              },
              { header: 'Gross', accessor: (row: SettlementEvent) => `$${(row.grossCents / 100).toFixed(2)}` },
              { header: 'Fees', accessor: (row: SettlementEvent) => `$${(row.feesCents / 100).toFixed(2)}` },
              { header: 'Net', accessor: (row: SettlementEvent) => `$${(row.netCents / 100).toFixed(2)}` },
              { header: 'Status', accessor: (row: SettlementEvent) => <StatusBadge status={row.status} /> },
              { header: 'Settled', accessor: (row: SettlementEvent) => formatDate(row.settledAt) },
            ]}
            data={settlementsData?.data ?? []}
          />
        </div>

        <div className="panel mt-lg">
          <h4 className="mb-md">Settlement Trend (Last {(settlementTrendData?.windowDays ?? 14)} Days)</h4>
          <DataTable
            columns={[
              { header: 'Date', accessor: (row: SettlementTrendRow) => row.date },
              { header: 'Count', accessor: (row: SettlementTrendRow) => row.count },
              { header: 'Gross', accessor: (row: SettlementTrendRow) => `$${(row.grossCents / 100).toFixed(2)}` },
              { header: 'Fees', accessor: (row: SettlementTrendRow) => `$${(row.feesCents / 100).toFixed(2)}` },
              { header: 'Net', accessor: (row: SettlementTrendRow) => `$${(row.netCents / 100).toFixed(2)}` },
              { header: 'Fee Rate', accessor: (row: SettlementTrendRow) => `${row.feeRatePercent.toFixed(2)}%` },
            ]}
            data={settlementTrendData?.data ?? []}
          />
        </div>
      </AnimatedPage>
    </RoleGate>
  );
}
