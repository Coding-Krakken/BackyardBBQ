'use client';

import { formatCurrency } from '@/lib/utils';

export interface RefundDraft {
  transactionId: string;
  amountCents: number;
  maxAmountCents: number;
  reason: string;
}

interface RefundModalProps {
  draft: RefundDraft | null;
  isProcessing: boolean;
  onDraftChange: (draft: RefundDraft) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function RefundModal({
  draft,
  isProcessing,
  onDraftChange,
  onClose,
  onConfirm,
}: RefundModalProps) {
  if (!draft) {
    return null;
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="refund-title">
      <div className="overlay-backdrop" onClick={onClose} />
      <div className="modal modal-sm">
        <h3 id="refund-title" className="modal-title">Issue Refund</h3>
        <p className="text-muted mb-md">
          You can issue a full or partial refund for this transaction.
        </p>

        <label className="form-label" htmlFor="refund-amount">Refund Amount (USD)</label>
        <input
          id="refund-amount"
          className="input"
          type="number"
          min="0.01"
          step="0.01"
          value={(draft.amountCents / 100).toFixed(2)}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            const nextCents = Number.isFinite(parsed) ? Math.round(parsed * 100) : draft.maxAmountCents;
            onDraftChange({
              ...draft,
              amountCents: Math.max(1, Math.min(nextCents, draft.maxAmountCents)),
            });
          }}
        />
        <p className="text-muted" style={{ marginTop: '0.35rem' }}>
          Maximum refundable amount: {formatCurrency(draft.maxAmountCents)}
        </p>

        <label className="form-label" htmlFor="refund-reason" style={{ marginTop: '0.75rem' }}>Reason</label>
        <select
          id="refund-reason"
          className="select"
          value={draft.reason}
          onChange={(event) => onDraftChange({ ...draft, reason: event.target.value })}
        >
          <option value="requested_by_customer">Requested by customer</option>
          <option value="duplicate">Duplicate charge</option>
          <option value="fraudulent">Fraudulent</option>
          <option value="order_cancelled">Order cancelled</option>
          <option value="other">Other</option>
        </select>

        <div className="modal-actions">
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={isProcessing}>Cancel</button>
          <button className="btn btn-danger btn-sm" onClick={onConfirm} disabled={isProcessing}>
            {isProcessing ? 'Processing...' : 'Issue Refund'}
          </button>
        </div>
      </div>
    </div>
  );
}
