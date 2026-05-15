/**
 * Shared utility functions for the admin dashboard.
 */

/** SWR fetcher that throws on non-OK responses. */
export const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('An error occurred while fetching data.');
    throw error;
  }
  return res.json();
};

/** Format cents to USD currency string. */
export const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

/** Format ISO date string to short readable format. */
export const formatDate = (dateString: string | Date) =>
  new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

/** Format date to long format (for detail pages). */
export const formatDateLong = (date: string | Date) =>
  new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

/** Format date to date-only (no time). */
export const formatDateShort = (date: string | Date) =>
  new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
