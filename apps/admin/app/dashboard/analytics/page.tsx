'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Card,
  Metric,
  Text,
  Select,
  SelectItem,
  TabGroup,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  AreaChart,
  DonutChart,
  LineChart,
  Callout,
  Badge,
  Button,
} from '@tremor/react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { RoleGate } from '@/components/RoleGate';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AnalyticsPage() {
  const [days, setDays] = useState('14');

  const { data: salesData } = useSWR(
    `/api/admin/analytics/sales?days=${days}`,
    fetcher
  );

  const { data: forecastData } = useSWR(
    '/api/admin/analytics/forecast?days=7',
    fetcher
  );

  const { data: anomaliesData } = useSWR(
    '/api/admin/analytics/anomalies?days=21',
    fetcher
  );

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const handleExport = async (type: 'sales' | 'forecast') => {
    const url = type === 'sales' 
      ? `/api/admin/analytics/sales/export?days=${days}`
      : '/api/admin/analytics/forecast/export?days=7';
    
    window.location.href = url;
  };

  return (
    <RoleGate allowedRoles={['owner', 'admin', 'manager']}>
    <div className="p-6">
      <PageHeader
        title="Analytics"
        subtitle="Sales performance, forecasting, and anomaly detection"
        action={
          <Select value={days} onValueChange={setDays}>
            <SelectItem value="7">Last 7 Days</SelectItem>
            <SelectItem value="14">Last 14 Days</SelectItem>
            <SelectItem value="30">Last 30 Days</SelectItem>
            <SelectItem value="90">Last 90 Days</SelectItem>
          </Select>
        }
      />

      {/* KPI Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <Text>Total Orders</Text>
          <Metric>{salesData?.totals.orders ?? 0}</Metric>
        </Card>
        <Card>
          <Text>Gross Revenue</Text>
          <Metric>{formatCurrency(salesData?.totals.grossSalesCents ?? 0)}</Metric>
        </Card>
        <Card>
          <Text>Average Order Value</Text>
          <Metric>{formatCurrency(salesData?.totals.averageOrderValueCents ?? 0)}</Metric>
        </Card>
      </div>

      {/* Charts */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-lg font-semibold text-bbq-light">Daily Trends</h3>
          <AreaChart
            className="h-80"
            data={salesData?.daily ?? []}
            index="date"
            categories={['orders', 'grossSalesCents']}
            colors={['orange', 'blue']}
            valueFormatter={(value) => 
              value > 1000 ? formatCurrency(value) : value.toString()
            }
          />
        </Card>
        <Card>
          <h3 className="mb-4 text-lg font-semibold text-bbq-light">Revenue by Source</h3>
          <DonutChart
            className="h-80"
            data={salesData?.bySource ?? []}
            category="grossSalesCents"
            index="source"
            valueFormatter={formatCurrency}
            colors={['orange', 'blue', 'green', 'purple', 'yellow']}
          />
        </Card>
      </div>

      {/* Top Items */}
      <Card className="mb-8">
        <h3 className="mb-4 text-lg font-semibold text-bbq-light">Top 10 Menu Items</h3>
        <DataTable
          columns={[
            { header: 'Item Name', accessor: (row: any) => row.name },
            { header: 'Quantity Sold', accessor: (row: any) => row.quantity },
            {
              header: 'Revenue',
              accessor: (row: any) => formatCurrency(row.revenueCents),
            },
          ]}
          data={salesData?.topItems ?? []}
        />
      </Card>

      {/* Tabs for Forecast and Anomalies */}
      <Card>
        <TabGroup>
          <div className="flex items-center justify-between">
            <TabList>
              <Tab>Sales Data</Tab>
              <Tab>Forecast (7d)</Tab>
              <Tab>Anomalies (21d)</Tab>
            </TabList>
          </div>
          <TabPanels>
            <TabPanel>
              <div className="mt-4">
                <Button size="sm" onClick={() => handleExport('sales')}>
                  Export CSV
                </Button>
              </div>
            </TabPanel>
            <TabPanel>
              <div className="mt-4">
                <LineChart
                  className="h-80"
                  data={forecastData?.forecast ?? []}
                  index="date"
                  categories={['predictedOrders', 'predictedSalesCents']}
                  colors={['orange', 'blue']}
                  valueFormatter={(value) => 
                    value > 1000 ? formatCurrency(value) : value.toString()
                  }
                />
                <div className="mt-4 flex gap-2">
                  <Badge color="gray">
                    Baseline: {forecastData?.baseline.trailingAverageOrders.toFixed(1)} orders/day
                  </Badge>
                  <Button size="sm" onClick={() => handleExport('forecast')}>
                    Export CSV
                  </Button>
                </div>
              </div>
            </TabPanel>
            <TabPanel>
              <div className="mt-4 space-y-3">
                {anomaliesData?.summary && (
                  <div className="mb-4 flex gap-3">
                    <Badge color="red">Critical: {anomaliesData.summary.critical}</Badge>
                    <Badge color="yellow">Warning: {anomaliesData.summary.warning}</Badge>
                    <Badge color="blue">Info: {anomaliesData.summary.info}</Badge>
                  </div>
                )}
                {anomaliesData?.anomalies.map((anomaly: any, idx: number) => (
                  <Callout
                    key={idx}
                    title={anomaly.title}
                    color={anomaly.severity === 'critical' ? 'red' : anomaly.severity === 'warning' ? 'yellow' : 'blue'}
                  >
                    {anomaly.detail}
                  </Callout>
                ))}
                {(!anomaliesData?.anomalies || anomaliesData.anomalies.length === 0) && (
                  <p className="text-gray-400">No anomalies detected in the last 21 days.</p>
                )}
              </div>
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </Card>
    </div>
    </RoleGate>
  );
}
