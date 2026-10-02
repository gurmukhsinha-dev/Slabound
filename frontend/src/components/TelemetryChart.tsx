'use client';

import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { TelemetryPoint } from '@/lib/mockData';
import { Activity, ShieldAlert } from 'lucide-react';

interface TelemetryChartProps {
  data: TelemetryPoint[];
  threshold: number;
  isBreached: boolean;
  vendorName: string;
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({
  data,
  threshold,
  isBreached,
  vendorName,
}) => {
  return (
    <div className="p-6 rounded-xl bg-[#111827] border border-gray-800 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white">Real-Time Telemetry Monitor</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 font-mono">
              {vendorName}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            CloudWatch Canary synthetic response time streams (30s cadence) vs ECA contract bounds
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-indigo-400"></span>
            <span className="text-gray-300">Measured Latency (ms)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-rose-500 stroke-dashed"></span>
            <span className="text-rose-400">SLA Breach Bound ({threshold}ms)</span>
          </div>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="#6B7280"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#374151' }}
            />
            <YAxis
              stroke="#6B7280"
              fontSize={11}
              domain={[0, 1100]}
              tickLine={false}
              axisLine={{ stroke: '#374151' }}
              tickFormatter={(v) => `${v}ms`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0F172A',
                borderColor: '#334155',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px',
              }}
              formatter={(value: any) => [`${value} ms`, 'Response Time']}
            />
            {/* Dynamic Contract Breach Threshold Line */}
            <ReferenceLine
              y={threshold}
              stroke="#F43F5E"
              strokeWidth={2}
              strokeDasharray="4 4"
              label={{
                value: `Contract SLA Limit: ${threshold}ms`,
                position: 'top',
                fill: '#F43F5E',
                fontSize: 11,
              }}
            />
            <Line
              type="monotone"
              dataKey="latency"
              stroke={isBreached ? '#F43F5E' : '#6366F1'}
              strokeWidth={2.5}
              dot={{ r: 3, fill: isBreached ? '#F43F5E' : '#6366F1' }}
              activeDot={{ r: 6, fill: '#38BDF8' }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-800/80 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-2">
          {isBreached ? (
            <span className="flex items-center gap-1.5 text-rose-400 font-semibold bg-rose-500/10 px-2.5 py-1 rounded-md border border-rose-500/20">
              <ShieldAlert className="w-3.5 h-3.5" /> Threshold breach: zk-SNARK prover activated
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
              <Activity className="w-3.5 h-3.5" /> Telemetry within guaranteed contractual parameters
            </span>
          )}
        </div>
        <span className="font-mono text-gray-500">Zero-Knowledge Masking: SHA-256 Hashed</span>
      </div>
    </div>
  );
};
