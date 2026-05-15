'use client';

import { ReactNode } from 'react';
import CountUp from 'react-countup';
import { motion } from 'framer-motion';

interface StatCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  icon?: ReactNode;
  colorClass?: string;
}

export function StatCard({
  label,
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  icon,
  colorClass,
}: StatCardProps) {
  return (
    <motion.div
      className="card stat-card"
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      {icon && <div className="stat-card-icon">{icon}</div>}
      <div className="stat-card-label">{label}</div>
      <div className={`stat-card-value ${colorClass || ''}`}>
        <CountUp
          start={0}
          end={value}
          duration={1.2}
          separator=","
          prefix={prefix}
          suffix={suffix}
          decimals={decimals}
          preserveValue
        />
      </div>
    </motion.div>
  );
}
