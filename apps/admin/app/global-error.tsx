'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ background: '#060809', color: '#f5ebda', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '4rem', color: '#d96d31', marginBottom: '1rem' }}>500</h1>
          <p style={{ color: '#b5aa9d', marginBottom: '1.5rem' }}>Something went wrong</p>
          <button onClick={reset} style={{ background: '#d96d31', color: '#f5ebda', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '10px', cursor: 'pointer', fontSize: '0.9rem' }}>
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
