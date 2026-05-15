'use client';

import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const COLORS = ['#d96d31', '#5a9fd4', '#5cb87a', '#c4a6f0', '#e0a832'];

interface BBQAreaChartProps {
  data: Record<string, unknown>[];
  index: string;
  categories: string[];
  colors?: string[];
  valueFormatter?: (value: number) => string;
  height?: number;
}

export function BBQAreaChart({
  data,
  index,
  categories,
  colors = COLORS,
  valueFormatter = (v) => String(v),
  height = 300,
}: BBQAreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey={index}
          tick={{ fill: '#7a7168', fontSize: 11 }}
          axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#7a7168', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={valueFormatter}
        />
        <Tooltip
          contentStyle={{
            background: 'rgba(7,12,16,0.92)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '10px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
          }}
          labelStyle={{ color: '#b5aa9d', fontWeight: 600, fontSize: '0.78rem' }}
          itemStyle={{ color: '#f5ebda', fontSize: '0.78rem' }}
          formatter={(value: number) => [valueFormatter(value)]}
        />
        <Legend />
        {categories.map((cat, i) => (
          <Area
            key={cat}
            type="monotone"
            dataKey={cat}
            stroke={colors[i % colors.length]}
            fill={colors[i % colors.length]}
            fillOpacity={0.12}
            strokeWidth={2}
          />
        ))}
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
}
