import { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

export function ChartCard({ title, action, children }: ChartCardProps) {
  return (
    <div className="panel">
      <div className="chart-header">
        <h3 className="chart-title">{title}</h3>
        {action && <div className="flex-gap">{action}</div>}
      </div>
      <div className="chart-body">
        {children}
      </div>
    </div>
  );
}
