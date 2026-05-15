'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Card, TextInput, Badge } from '@tremor/react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { RoleGate } from '@/components/RoleGate';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Customer {
  id: string;
  email: string;
  name?: string;
  phone?: string | null;
  role: string;
  ordersCount: number;
  bookingsCount: number;
  memberSince: string;
}

export default function CustomersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading } = useSWR<{ data: Customer[] }>(
    debouncedQuery
      ? `/api/admin/customers?q=${encodeURIComponent(debouncedQuery)}`
      : '/api/admin/customers?limit=50',
    fetcher
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, any> = {
      owner: 'red',
      admin: 'orange',
      manager: 'blue',
      staff: 'green',
      accounting: 'purple',
      customer: 'gray',
    };
    return colors[role] || 'gray';
  };

  return (
    <RoleGate allowedRoles={['owner', 'admin', 'manager']}>
    <div className="p-6">
      <PageHeader
        title="Customers"
        subtitle="Search and manage customer accounts"
      />

      {/* Search */}
      <Card className="mb-6">
        <TextInput
          placeholder="Search by email or name..."
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
      </Card>

      {/* Customers Table */}
      <Card>
        <DataTable
          columns={[
            {
              header: 'Name',
              accessor: (row: Customer) => row.name || 'N/A',
            },
            { header: 'Email', accessor: (row: Customer) => row.email },
            {
              header: 'Role',
              accessor: (row: Customer) => (
                <Badge color={getRoleBadgeColor(row.role)}>{row.role}</Badge>
              ),
            },
            {
              header: 'Total Orders',
              accessor: (row: Customer) => row.ordersCount,
            },
            {
              header: 'Total Bookings',
              accessor: (row: Customer) => row.bookingsCount,
            },
            {
              header: 'Member Since',
              accessor: (row: Customer) => formatDate(row.memberSince),
            },
            {
              header: 'Actions',
              accessor: (row: Customer) => (
                <Link
                  href={`/dashboard/customers/${row.id}`}
                  className="inline-flex items-center rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-800"
                >
                  View
                </Link>
              ),
            },
          ]}
          data={data?.data ?? []}
          isLoading={isLoading}
        />
      </Card>
    </div>
    </RoleGate>
  );
}
