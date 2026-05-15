'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, Metric, Text, Badge, Callout, Button } from '@tremor/react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RoleGate } from '@/components/RoleGate';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ChannelHealth {
  channel: string;
  status: 'healthy' | 'degraded' | 'down';
  processedCount: number;
  failedCount: number;
  deadLetterDepth: number;
  averageLatencyMs: number;
}

interface Alert {
  severity: 'critical' | 'warning' | 'info';
  channel: string;
  message: string;
}

interface DeadLetterEvent {
  id: string;
  channel: string;
  eventType: string;
  payload: any;
  createdAt: string;
}

export default function IntegrationsPage() {
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const { data: healthData } = useSWR<{ data: ChannelHealth[] }>(
    '/api/admin/integrations/health',
    fetcher,
    { refreshInterval: 60000 }
  );

  const { data: alertsData } = useSWR<{ data: Alert[] }>(
    '/api/admin/integrations/alerts',
    fetcher,
    { refreshInterval: 60000 }
  );

  const { data: deadLetterData, mutate: mutateDeadLetter } = useSWR<{ data: DeadLetterEvent[] }>(
    '/api/admin/integrations/dead-letter',
    fetcher
  );

  const handleRetry = async () => {
    if (!selectedEvent) return;

    setIsRetrying(true);
    try {
      const response = await fetch(`/api/admin/integrations/dead-letter/${selectedEvent}/retry`, {
        method: 'PATCH',
      });

      if (response.ok) {
        await mutateDeadLetter();
        setSelectedEvent(null);
      }
    } catch (error) {
      console.error('Failed to retry event:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, any> = {
      healthy: 'green',
      degraded: 'yellow',
      down: 'red',
    };
    return colors[status] || 'gray';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <RoleGate allowedRoles={['owner', 'admin']}>
    <div className="p-6">
      <PageHeader
        title="Integrations Health"
        subtitle="Monitor delivery channel health and failed events"
      />

      {/* Health Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {healthData?.data.map((channel) => (
          <Card key={channel.channel}>
            <div className="flex items-center justify-between">
              <Text>{channel.channel.toUpperCase()}</Text>
              <Badge color={getStatusBadgeColor(channel.status)}>{channel.status}</Badge>
            </div>
            <Metric className="mt-2">{channel.processedCount}</Metric>
            <div className="mt-2 space-y-1 text-xs text-gray-400">
              <div>Failed: {channel.failedCount}</div>
              <div>Dead Letter: {channel.deadLetterDepth}</div>
              <div>Latency: {channel.averageLatencyMs}ms</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Alerts */}
      {alertsData?.data && alertsData.data.length > 0 && (
        <div className="mb-8">
          <h3 className="mb-4 text-lg font-semibold text-bbq-light">Active Alerts</h3>
          <div className="space-y-3">
            {alertsData.data.map((alert, idx) => (
              <Callout
                key={idx}
                title={`${alert.channel.toUpperCase()} - ${alert.severity.toUpperCase()}`}
                color={
                  alert.severity === 'critical'
                    ? 'red'
                    : alert.severity === 'warning'
                    ? 'yellow'
                    : 'blue'
                }
              >
                {alert.message}
              </Callout>
            ))}
          </div>
        </div>
      )}

      {/* Dead Letter Queue */}
      <Card>
        <h3 className="mb-4 text-lg font-semibold text-bbq-light">Dead Letter Queue</h3>
        {deadLetterData?.data && deadLetterData.data.length > 0 ? (
          <DataTable
            columns={[
              {
                header: 'Channel',
                accessor: (row: DeadLetterEvent) => row.channel.toUpperCase(),
              },
              { header: 'Event Type', accessor: (row: DeadLetterEvent) => row.eventType },
              {
                header: 'Payload',
                accessor: (row: DeadLetterEvent) =>
                  JSON.stringify(row.payload).slice(0, 50) + '...',
              },
              {
                header: 'Created',
                accessor: (row: DeadLetterEvent) => formatDate(row.createdAt),
              },
              {
                header: 'Actions',
                accessor: (row: DeadLetterEvent) => (
                  <Button
                    size="xs"
                    color="orange"
                    variant="secondary"
                    onClick={() => setSelectedEvent(row.id)}
                  >
                    Retry
                  </Button>
                ),
              },
            ]}
            data={deadLetterData.data}
          />
        ) : (
          <p className="text-gray-400">No failed events in the dead letter queue.</p>
        )}
      </Card>

      {/* Retry Confirmation */}
      <ConfirmDialog
        isOpen={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
        onConfirm={handleRetry}
        title="Retry Failed Event"
        message="Are you sure you want to retry this failed event? It will be reprocessed."
        confirmText="Retry"
        isLoading={isRetrying}
      />
    </div>
    </RoleGate>
  );
}
