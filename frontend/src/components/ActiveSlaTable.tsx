'use client';

import React from 'react';
import { VendorContract } from '@/lib/mockData';
import { CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';

interface ActiveSlaTableProps {
  contracts: VendorContract[];
}

export const ActiveSlaTable: React.FC<ActiveSlaTableProps> = ({ contracts }) => {
  return (
    <div className="p-6 rounded-xl bg-[#111827] border border-gray-800 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">Active SLA Contracts (ECA Graph)</h2>
          <p className="text-xs text-gray-400">
            Parsed legal terms persisted into Amazon Neptune Graph DB
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono">
          Neptune Gremlin Model
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 font-medium uppercase tracking-wider">
              <th className="pb-3 pl-2">Vendor / Service</th>
              <th className="pb-3">Monitored Endpoint</th>
              <th className="pb-3 text-center">Max Latency</th>
              <th className="pb-3 text-center">Breach Window</th>
              <th className="pb-3 text-center">Penalty Credit</th>
              <th className="pb-3 text-center">Max Cap</th>
              <th className="pb-3 pr-2 text-right">ECA Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60 text-gray-300">
            {contracts.map((c) => (
              <tr key={c.vendor_id} className="hover:bg-gray-800/30 transition">
                <td className="py-3.5 pl-2 font-medium text-white flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                  {c.vendor_name}
                </td>
                <td className="py-3.5 font-mono text-[11px] text-gray-400 max-w-[200px] truncate" title={c.endpoint}>
                  {c.endpoint}
                </td>
                <td className="py-3.5 text-center font-mono text-amber-400 font-semibold">
                  {c.threshold_ms}ms
                </td>
                <td className="py-3.5 text-center text-gray-300">
                  {c.evaluation_window_min} min consecutive
                </td>
                <td className="py-3.5 text-center text-emerald-400 font-semibold">
                  {c.penalty_percentage}% refund
                </td>
                <td className="py-3.5 text-center font-mono text-gray-400">
                  ${c.max_cap_usd.toLocaleString()}
                </td>
                <td className="py-3.5 pr-2 text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
