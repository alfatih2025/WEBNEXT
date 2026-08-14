import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { SensorData } from '../hooks/useSensorData';

interface SensorChartProps {
  data: any[];
  type: 'temperature' | 'humidity' | 'soil_moisture';
  title: string;
  color: string;
}

const typeConfig = {
  temperature: { label: 'Suhu (°C)', min: 15, max: 45 },
  humidity: { label: 'Kelembapan (%)', min: 0, max: 100 },
  soil_moisture: { label: 'Kelembapan Tanah (%)', min: 0, max: 100 },
};

export function SensorChart({ data, type, title, color }: SensorChartProps) {
  const chartData = useMemo(() => {
    return [...data]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((item) => ({
        time: new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        value: item[type],
        fullDate: new Date(item.created_at).toLocaleString('id-ID'),
      }));
  }, [data, type]);

  const config = typeConfig[type];

  return (
    <div className="glass-card bg-white light-card dark:bg-slate-900/50 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${type}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeOpacity={0.5} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
              tickLine={false}
              axisLine={{ stroke: "currentColor" }} className="text-slate-200 dark:text-slate-800"
            />
            <YAxis
              domain={[config.min, config.max]}
              tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
              tickLine={false}
              axisLine={false}
              label={{ value: config.label, angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)', color: 'var(--text-primary)',
              }}
              labelStyle={{ color: 'var(--text-secondary)', fontSize: 12 }}
              formatter={(value) => {
                if (typeof value === 'number') {
                  return [`${value.toFixed(1)}`, config.label];
                }
                const parsed = Number(value);
                return [Number.isFinite(parsed) ? parsed.toFixed(1) : value, config.label];
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={`url(#gradient-${type})`}
              strokeWidth={2}
              dot={{ fill: color, strokeWidth: 0, r: 3 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
