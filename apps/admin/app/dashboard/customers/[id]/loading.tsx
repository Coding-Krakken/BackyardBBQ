import { LoadingSkeleton } from '@/components/LoadingSkeleton';

export default function CustomerDetailLoading() {
  return (
    <div className="page-detail">
      <div className="skeleton" style={{ height: '32px', width: '140px', marginBottom: '1rem' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <div className="skeleton" style={{ height: '24px', width: '200px', marginBottom: '0.5rem' }} />
          <div className="skeleton" style={{ height: '14px', width: '180px' }} />
        </div>
      </div>
      <div className="grid-cards grid-cards-2 mb-lg">
        <div className="panel"><LoadingSkeleton rows={3} /></div>
        <div className="panel"><LoadingSkeleton rows={3} /></div>
      </div>
      <div className="panel mb-lg"><LoadingSkeleton rows={5} /></div>
      <div className="panel"><LoadingSkeleton rows={4} /></div>
    </div>
  );
}
