import type { NextPageContext } from 'next';

function Error({ statusCode }: { statusCode?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#060809', color: '#f5ebda', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '4rem', color: '#d96d31', marginBottom: '1rem' }}>{statusCode || 'Error'}</h1>
        <p style={{ color: '#b5aa9d' }}>
          {statusCode === 404 ? 'Page not found' : 'An unexpected error occurred'}
        </p>
      </div>
    </div>
  );
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
