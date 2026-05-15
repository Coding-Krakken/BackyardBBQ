export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="skeleton skeleton-row" />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return <div className="skeleton skeleton-card" />;
}

export function ChartSkeleton() {
  return <div className="skeleton skeleton-chart" />;
}

export function TablePageSkeleton({ cards = 0 }: { cards?: number } = {}) {
  return (
    <div className="page-padding">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="skeleton" style={{ height: '28px', width: '180px' }} />
        <div className="skeleton" style={{ height: '14px', width: '260px' }} />
        {cards > 0 && (
          <div className={`grid-cards grid-cards-${Math.min(cards, 4)}`} style={{ marginTop: '0.5rem' }}>
            {Array.from({ length: cards }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}
        <div className="panel" style={{ marginTop: '0.5rem', padding: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="skeleton skeleton-row" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="page-padding">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="skeleton" style={{ height: '28px', width: '200px' }} />
        <div className="skeleton" style={{ height: '14px', width: '300px' }} />
        <div className="grid-cards grid-cards-3" style={{ marginTop: '0.5rem' }}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="skeleton skeleton-chart" style={{ marginTop: '0.5rem' }} />
      </div>
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <div className="page-padding" style={{ maxWidth: '1100px' }}>
      <div className="skeleton" style={{ height: '14px', width: '120px', marginBottom: '1rem' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <div className="skeleton" style={{ height: '28px', width: '220px', marginBottom: '0.5rem' }} />
          <div className="skeleton" style={{ height: '14px', width: '160px' }} />
        </div>
        <div className="skeleton" style={{ height: '24px', width: '80px', borderRadius: '999px' }} />
      </div>
      <div className="grid-cards grid-cards-2" style={{ marginBottom: '1.5rem' }}>
        <div className="panel" style={{ padding: '1rem' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton skeleton-row" style={{ marginBottom: '6px' }} />
          ))}
        </div>
        <div className="panel" style={{ padding: '1rem' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton skeleton-row" style={{ marginBottom: '6px' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
