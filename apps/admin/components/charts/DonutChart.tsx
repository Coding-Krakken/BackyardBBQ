'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const COLORS = ['#d96d31', '#5a9fd4', '#5cb87a', '#c4a6f0', '#e0a832', '#b89258'];

interface BBQDonutChartProps {
  data: Record<string, unknown>[];
  category: string;
  index: string;
  colors?: string[];
  valueFormatter?: (value: number) => string;
  height?: number;
}

export function BBQDonutChart({
  data,
  category,
  index,
  colors = COLORS,
  valueFormatter = (v) => String(v),
  height = 300,
}: BBQDonutChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey={category}
          nameKey={index}
          cx="50%"
          cy="50%"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={3}
          strokeWidth={0}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: 'rgba(7,12,16,0.92)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '10px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
          }}
          labelStyle={{ color: '#b5aa9d', fontWeight: 600 }}
          itemStyle={{ color: '#f5ebda' }}
          formatter={(value: number) => [valueFormatter(value)]}
        />
        <Legend
          formatter={(value) => <span style={{ color: '#b5aa9d', fontSize: '0.76rem' }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
