'use client';

import { motion } from 'framer-motion';
import { getAllFeaturesByStatus } from '@/lib/onboarding/dynamic-content';
import { FeatureStatusBadge } from './FeatureStatusBadge';

export function RoadmapStep() {
  const grouped = getAllFeaturesByStatus();

  return (
    <div className="onboarding-roadmap-container">
      <h2 className="onboarding-roadmap-title">Platform Roadmap</h2>
      <p className="onboarding-roadmap-subtitle">
        Here&apos;s where everything stands across your entire platform.
      </p>

      {/* Complete */}
      <motion.div
        className="onboarding-roadmap-group"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="onboarding-roadmap-group-header">
          <FeatureStatusBadge status="complete" />
          <span className="onboarding-roadmap-count">{grouped.complete.length} features</span>
        </div>
        <div className="onboarding-roadmap-items">
          {grouped.complete.map((f) => (
            <div key={f.key} className="onboarding-roadmap-card complete">
              <strong>{f.label}</strong>
              <span>{f.description}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* In Progress */}
      {grouped.inProgress.length > 0 && (
        <motion.div
          className="onboarding-roadmap-group"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="onboarding-roadmap-group-header">
            <FeatureStatusBadge status="in-progress" />
            <span className="onboarding-roadmap-count">{grouped.inProgress.length} features</span>
          </div>
          <div className="onboarding-roadmap-items">
            {grouped.inProgress.map((f) => (
              <div key={f.key} className="onboarding-roadmap-card progress">
                <strong>{f.label}</strong>
                {f.eta && <span className="onboarding-eta">ETA: {f.eta}</span>}
                <span>{f.description}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Planned */}
      {grouped.planned.length > 0 && (
        <motion.div
          className="onboarding-roadmap-group"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="onboarding-roadmap-group-header">
            <FeatureStatusBadge status="planned" />
            <span className="onboarding-roadmap-count">{grouped.planned.length} features</span>
          </div>
          <div className="onboarding-roadmap-items">
            {grouped.planned.map((f) => (
              <div key={f.key} className="onboarding-roadmap-card planned">
                <strong>{f.label}</strong>
                {f.eta && <span className="onboarding-eta">ETA: {f.eta}</span>}
                <span>{f.description}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
