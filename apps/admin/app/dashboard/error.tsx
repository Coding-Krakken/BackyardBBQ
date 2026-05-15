'use client';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="error-page">
      <div className="error-page-icon">⚠</div>
      <h2>Something went wrong</h2>
      <p>{error.message || 'An unexpected error occurred while loading this page.'}</p>
      <button className="btn btn-primary" onClick={reset}>
        Try Again
      </button>
    </div>
  );
}
