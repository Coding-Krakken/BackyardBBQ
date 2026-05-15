'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="error-page">
      <div className="error-page-content">
        <h1 className="error-page-code">500</h1>
        <p className="error-page-message">Something went wrong</p>
        <button onClick={reset} className="btn btn-primary">
          Try Again
        </button>
      </div>
    </div>
  );
}
