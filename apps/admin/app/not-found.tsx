import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="error-page">
      <div className="error-page-content">
        <h1 className="error-page-code">404</h1>
        <p className="error-page-message">Page not found</p>
        <Link href="/dashboard" className="btn btn-primary">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
