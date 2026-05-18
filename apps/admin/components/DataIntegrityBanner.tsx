'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/utils';

interface DataIntegrityResult {
  healthy: boolean;
  ordersWithoutPayments: number;
  paymentsWithoutOrders: number;
  sumDifferenceCents: number;
  details?: string;
}

/**
 * Displays a warning banner when data integrity issues are detected.
 * Only visible to users who can access the health endpoint (owner, admin, accounting).
 */
export function DataIntegrityBanner() {
  const { data, error } = useSWR<DataIntegrityResult>(
    '/api/admin/health/data-integrity',
    fetcher,
    {
      refreshInterval: 60000, // Check every minute
      errorRetryCount: 1, // Don't retry aggressively on auth errors
    }
  );

  // Don't show anything if loading, error, or healthy
  if (!data || error || data.healthy) {
    return null;
  }

  return (
    <div
      className="panel"
      style={{
        background: 'rgba(217, 109, 49, 0.15)',
        borderColor: 'var(--ember)',
        marginBottom: 'var(--spacing-lg)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--spacing-md)',
        }}
      >
        <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>WARN</span>
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--ember)',
            }}
          >
            Data Integrity Warning
          </h3>
          <p
            style={{
              margin: '0.25rem 0 0',
              fontSize: '0.9rem',
              opacity: 0.9,
            }}
          >
            {data.details}
          </p>
          <div
            style={{
              display: 'flex',
              gap: 'var(--spacing-md)',
              marginTop: '0.75rem',
              fontSize: '0.85rem',
            }}
          >
            {data.ordersWithoutPayments > 0 && (
              <span>
                <strong>{data.ordersWithoutPayments}</strong> orphaned orders
              </span>
            )}
            {data.paymentsWithoutOrders > 0 && (
              <span>
                <strong>{data.paymentsWithoutOrders}</strong> orphaned payments
              </span>
            )}
            {data.sumDifferenceCents > 0 && (
              <span>
                <strong>${(data.sumDifferenceCents / 100).toFixed(2)}</strong> discrepancy
              </span>
            )}
          </div>
          <p
            style={{
              margin: '0.75rem 0 0',
              fontSize: '0.8rem',
              opacity: 0.7,
            }}
          >
            Run <code>node scripts/data-integrity-check.mjs</code> for details.
          </p>
        </div>
      </div>
    </div>
  );
}
