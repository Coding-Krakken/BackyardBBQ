'use client';

import type { FeatureStatus } from '@/lib/onboarding/dynamic-content';

interface FeatureStatusBadgeProps {
  status: FeatureStatus;
  eta?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<FeatureStatus, { icon: string; label: string; className: string }> = {
  complete: { icon: '✓', label: 'Live', className: 'onboarding-badge-complete' },
  'in-progress': { icon: '◐', label: 'In Progress', className: 'onboarding-badge-progress' },
  planned: { icon: '○', label: 'Planned', className: 'onboarding-badge-planned' },
};

export function FeatureStatusBadge({ status, eta, showLabel = true, size = 'md' }: FeatureStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span className={`onboarding-feature-badge ${config.className} ${size === 'sm' ? 'badge-sm' : ''}`}>
      <span className="onboarding-badge-icon">{config.icon}</span>
      {showLabel && <span>{config.label}</span>}
      {eta && status !== 'complete' && (
        <span className="onboarding-eta">ETA: {eta}</span>
      )}
    </span>
  );
}
