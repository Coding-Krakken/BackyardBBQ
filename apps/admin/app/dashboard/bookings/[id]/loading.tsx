import { LoadingSkeleton } from '@/components/LoadingSkeleton';

export default function BookingDetailLoading() {
  return (
    <div className="page-detail">
      <div className="skeleton" style={{ height: '32px', width: '140px', marginBottom: '1rem' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <div className="skeleton" style={{ height: '24px', width: '220px', marginBottom: '0.5rem' }} />
          <div className="skeleton" style={{ height: '14px', width: '160px' }} />
        </div>
        <div className="skeleton" style={{ height: '24px', width: '80px', borderRadius: '999px' }} />
      </div>
      <div className="grid-cards grid-cards-2 mb-lg">
        <div className="panel"><LoadingSkeleton rows={5} /></div>
        <div className="panel"><LoadingSkeleton rows={3} /></div>
      </div>
    </div>
  );
}
