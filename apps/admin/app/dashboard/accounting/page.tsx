'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, Metric, Text, Button, TextInput } from '@tremor/react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useSession } from 'next-auth/react';
import { RoleGate } from '@/components/RoleGate';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AccountingPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string })?.role;
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);

  const { data, mutate } = useSWR(
    `/api/admin/accounting/daily-close?date=${date}`,
    fetcher
  );

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const handleFinalize = async () => {
    setIsFinalizing(true);
    try {
      const response = await fetch('/api/admin/accounting/daily-close/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      });

      if (response.ok) {
        await mutate();
        setShowFinalizeDialog(false);
      }
    } catch (error) {
      console.error('Failed to finalize daily close:', error);
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleExport = () => {
    window.location.href = `/api/admin/accounting/daily-close/export?date=${date}`;
  };

  return (
    <RoleGate allowedRoles={['owner', 'admin', 'accounting']}>
    <div className="p-6">
      <PageHeader
        title="Accounting"
        subtitle="Daily close and financial reconciliation"
        action={
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-tremor-default border-tremor-border bg-tremor-background px-3 py-2 text-tremor-content dark:border-dark-tremor-border dark:bg-dark-tremor-background dark:text-dark-tremor-content"
            />
            <Button size="sm" variant="secondary" onClick={handleExport}>
              Export CSV
            </Button>
          </div>
        }
      />

      {/* Status Indicator */}
      {data?.finalized && (
        <div className="mb-6 rounded-lg border border-green-500 bg-green-500 bg-opacity-10 p-4">
          <p className="text-green-400">✓ This day has been finalized</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <Text>Gross Sales</Text>
          <Metric className="text-green-400">
            {formatCurrency(data?.summary.grossSalesCents ?? 0)}
          </Metric>
        </Card>
        <Card>
          <Text>Refunded</Text>
          <Metric className="text-red-400">
            {formatCurrency(data?.summary.refundedCents ?? 0)}
          </Metric>
        </Card>
        <Card>
          <Text>Net Sales</Text>
          <Metric className="text-bbq-orange">
            {formatCurrency(data?.summary.netSalesCents ?? 0)}
          </Metric>
        </Card>
      </div>

      {/* By Source Breakdown */}
      <Card className="mb-8">
        <h3 className="mb-4 text-lg font-semibold text-bbq-light">Revenue by Source</h3>
        <DataTable
          columns={[
            {
              header: 'Source',
              accessor: (row: any) => row.source.toUpperCase(),
            },
            { header: 'Orders', accessor: (row: any) => row.orders },
            {
              header: 'Total',
              accessor: (row: any) => formatCurrency(row.totalCents),
            },
          ]}
          data={data?.bySource ?? []}
        />
      </Card>

      {/* Finalize Button - Owner Only */}
      {userRole === 'owner' && !data?.finalized && (
        <div className="flex justify-end">
          <Button
            size="lg"
            color="orange"
            onClick={() => setShowFinalizeDialog(true)}
          >
            Finalize Day
          </Button>
        </div>
      )}

      {userRole !== 'owner' && !data?.finalized && (
        <p className="text-right text-sm text-gray-400">
          Only owners can finalize daily close
        </p>
      )}

      {/* Finalize Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showFinalizeDialog}
        onClose={() => setShowFinalizeDialog(false)}
        onConfirm={handleFinalize}
        title="Finalize Daily Close"
        message={`Are you sure you want to finalize the daily close for ${date}? This action marks the day as closed and cannot be undone.`}
        confirmText="Finalize"
        variant="primary"
        isLoading={isFinalizing}
      />
    </div>
    </RoleGate>
  );
}
