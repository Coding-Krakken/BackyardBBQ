'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { RoleGate } from '@/components/RoleGate';
import { AnimatedPage } from '@/components/AnimatedPage';
import { fetcher, formatDate } from '@/lib/utils';

interface Customer {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  createdAt: string;
  _count?: { orders: number; bookings: number };
}

export default function CustomersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;
  const offset = (page - 1) * limit;

  const { data, isLoading } = useSWR<{ data: Customer[] }>(
    `/api/admin/customers?limit=${limit}&offset=${offset}&search=${encodeURIComponent(searchQuery)}`,
    fetcher
  );

  return (
    <RoleGate allowedRoles={['owner', 'admin', 'manager']}>
      <AnimatedPage>
        <PageHeader
          title="Customers"
          subtitle="View and manage your customer base"
        />

        <div className="panel mb-lg">
          <div className="form-group">
            <label className="form-label">Search</label>
            <input
              className="input"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="panel">
          <DataTable
            columns={[
              { header: 'Name', accessor: (row: Customer) => row.name ?? 'N/A', sortKey: (row: Customer) => row.name ?? '' },
              { header: 'Email', accessor: (row: Customer) => row.email, sortKey: (row: Customer) => row.email },
              { header: 'Phone', accessor: (row: Customer) => row.phone ?? 'N/A' },
              { header: 'Orders', accessor: (row: Customer) => row._count?.orders ?? 0, sortKey: (row: Customer) => row._count?.orders ?? 0 },
              { header: 'Bookings', accessor: (row: Customer) => row._count?.bookings ?? 0, sortKey: (row: Customer) => row._count?.bookings ?? 0 },
              { header: 'Joined', accessor: (row: Customer) => formatDate(row.createdAt), sortKey: (row: Customer) => row.createdAt },
              {
                header: 'Actions',
                accessor: (row: Customer) => (
                  <Link href={`/dashboard/customers/${row.id}`} className="btn btn-ghost btn-xs">View</Link>
                ),
              },
            ]}
            data={data?.data ?? []}
            currentPage={page}
            totalPages={Math.max(1, Math.ceil((data?.data.length ?? 0) / limit))}
            onPageChange={setPage}
            isLoading={isLoading}
          />
        </div>
      </AnimatedPage>
    </RoleGate>
  );
}
