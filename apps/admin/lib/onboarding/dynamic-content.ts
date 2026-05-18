import featureStatusConfig from '../../config/feature-status.json';

export type FeatureStatus = 'complete' | 'in-progress' | 'planned';

export interface FeatureInfo {
  status: FeatureStatus;
  label: string;
  description: string;
  eta?: string;
  details?: string;
  completedItems?: string[];
  remainingItems?: string[];
  plannedItems?: string[];
}

export interface FeatureStatusConfig {
  version: number;
  lastUpdated: string;
  features: Record<string, FeatureInfo>;
}

export function getFeatureConfig(): FeatureStatusConfig {
  return featureStatusConfig as FeatureStatusConfig;
}

export function getFeature(key: string): FeatureInfo | null {
  const config = getFeatureConfig();
  return config.features[key] ?? null;
}

export function getFeatureVersion(): number {
  return getFeatureConfig().version;
}

export function getStatusBadgeHTML(status: FeatureStatus): string {
  const config: Record<FeatureStatus, { icon: string; label: string; className: string }> = {
    complete: { icon: '✓', label: 'Live', className: 'onboarding-badge-complete' },
    'in-progress': { icon: '◐', label: 'In Progress', className: 'onboarding-badge-progress' },
    planned: { icon: '○', label: 'Planned', className: 'onboarding-badge-planned' },
  };

  const badge = config[status];
  return `<span class="onboarding-feature-badge ${badge.className}"><span class="onboarding-badge-icon">${badge.icon}</span> ${badge.label}</span>`;
}

export function getFeatureBadgeHTML(featureKey: string): string {
  const feature = getFeature(featureKey);
  if (!feature) return '';

  let html = getStatusBadgeHTML(feature.status);

  if (feature.eta && feature.status !== 'complete') {
    html += ` <span class="onboarding-eta">ETA: ${feature.eta}</span>`;
  }

  return html;
}

export function buildFeatureDescription(featureKey: string): string {
  const feature = getFeature(featureKey);
  if (!feature) return '';

  let html = `<div class="onboarding-feature-detail">`;
  html += `<div class="onboarding-feature-header">${getFeatureBadgeHTML(featureKey)}</div>`;
  html += `<p>${feature.description}</p>`;

  if (feature.details) {
    html += `<p class="onboarding-feature-context">${feature.details}</p>`;
  }

  if (feature.completedItems && feature.completedItems.length > 0) {
    html += `<div class="onboarding-checklist"><div class="onboarding-checklist-title">✓ Completed</div>`;
    for (const item of feature.completedItems) {
      html += `<div class="onboarding-checklist-item done">✓ ${item}</div>`;
    }
    html += `</div>`;
  }

  if (feature.remainingItems && feature.remainingItems.length > 0) {
    html += `<div class="onboarding-checklist"><div class="onboarding-checklist-title">⏳ Remaining</div>`;
    for (const item of feature.remainingItems) {
      html += `<div class="onboarding-checklist-item pending">○ ${item}</div>`;
    }
    html += `</div>`;
  }

  if (feature.plannedItems && feature.plannedItems.length > 0) {
    html += `<div class="onboarding-checklist"><div class="onboarding-checklist-title">📋 Planned</div>`;
    for (const item of feature.plannedItems) {
      html += `<div class="onboarding-checklist-item planned">○ ${item}</div>`;
    }
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

export function getAllFeaturesByStatus(): {
  complete: Array<{ key: string } & FeatureInfo>;
  inProgress: Array<{ key: string } & FeatureInfo>;
  planned: Array<{ key: string } & FeatureInfo>;
} {
  const config = getFeatureConfig();
  const result = {
    complete: [] as Array<{ key: string } & FeatureInfo>,
    inProgress: [] as Array<{ key: string } & FeatureInfo>,
    planned: [] as Array<{ key: string } & FeatureInfo>,
  };

  for (const [key, feature] of Object.entries(config.features)) {
    const entry = { key, ...feature };
    if (feature.status === 'complete') result.complete.push(entry);
    else if (feature.status === 'in-progress') result.inProgress.push(entry);
    else result.planned.push(entry);
  }

  return result;
}

export function buildRoadmapHTML(): string {
  const grouped = getAllFeaturesByStatus();

  let html = `<div class="onboarding-roadmap">`;

  // Complete
  html += `<div class="onboarding-roadmap-section">`;
  html += `<div class="onboarding-roadmap-header complete"><span class="onboarding-badge-icon">✓</span> Live &amp; Operational (${grouped.complete.length})</div>`;
  for (const f of grouped.complete) {
    html += `<div class="onboarding-roadmap-item complete"><strong>${f.label}</strong><span>${f.description}</span></div>`;
  }
  html += `</div>`;

  // In progress
  if (grouped.inProgress.length > 0) {
    html += `<div class="onboarding-roadmap-section">`;
    html += `<div class="onboarding-roadmap-header progress"><span class="onboarding-badge-icon">◐</span> In Development (${grouped.inProgress.length})</div>`;
    for (const f of grouped.inProgress) {
      html += `<div class="onboarding-roadmap-item progress"><strong>${f.label}</strong>${f.eta ? ` <span class="onboarding-eta">ETA: ${f.eta}</span>` : ''}<span>${f.description}</span></div>`;
    }
    html += `</div>`;
  }

  // Planned
  if (grouped.planned.length > 0) {
    html += `<div class="onboarding-roadmap-section">`;
    html += `<div class="onboarding-roadmap-header planned"><span class="onboarding-badge-icon">○</span> On the Roadmap (${grouped.planned.length})</div>`;
    for (const f of grouped.planned) {
      html += `<div class="onboarding-roadmap-item planned"><strong>${f.label}</strong>${f.eta ? ` <span class="onboarding-eta">ETA: ${f.eta}</span>` : ''}<span>${f.description}</span></div>`;
    }
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}
