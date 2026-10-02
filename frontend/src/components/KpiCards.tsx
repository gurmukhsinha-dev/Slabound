'use client';

import React from 'react';
import { Layers, Activity, DollarSign, ArrowUpRight, TrendingDown } from 'lucide-react';

interface KpiCardsProps {
  activeVendorsCount: number;
  avgLatency: number;
  isBreached: boolean;
  totalCreditsRecovered: number;
}

export const KpiCards: React.FC<KpiCardsProps> = ({
  activeVendorsCount,
  avgLatency,
  isBreached,
  totalCreditsRecovered,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Card 1: Active SLAs Monitored */}
      <div className="p-5 rounded-xl bg-[#111827] border border-gray-800 shadow-sm relative overflow-hidden group hover:border-gray-700 transition">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Active SLAs Monitored
            </p>
            <h3 className="text-2xl font-bold text-white mt-1">
              {activeVendorsCount} Vendors
            </h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Layers className="w-6 h-6" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-400">
          <span className="text-emerald-400 font-medium flex items-center">
            <ArrowUpRight className="w-3.5 h-3.5" /> 100%
          </span>
          <span>ECA Graph contracts compiled in Neptune DB</span>
        </div>
      </div>

      {/* Card 2: System Health / Latency Status */}
      <div className={`p-5 rounded-xl bg-[#111827] border shadow-sm relative overflow-hidden transition ${
        isBreached ? 'border-rose-500/80 bg-rose-950/10 breach-glow' : 'border-gray-800 hover:border-gray-700'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              System Health / Latency Status
            </p>
            <h3 className={`text-2xl font-bold mt-1 ${isBreached ? 'text-rose-400' : 'text-emerald-400'}`}>
              {isBreached ? `BREACH DETECTED - ${avgLatency.toFixed(0)}ms` : `OPERATIONAL - ${avgLatency.toFixed(0)}ms Avg`}
            </h3>
          </div>
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${
            isBreached 
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' 
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          }`}>
            <Activity className="w-6 h-6" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-400">
          <span className={`w-2 h-2 rounded-full ${isBreached ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'}`} />
          <span>{isBreached ? 'Consecutive multi-window threshold violation' : 'CloudWatch Synthetics Canary 30s ping'}</span>
        </div>
      </div>

      {/* Card 3: Total Credits Recovered */}
      <div className="p-5 rounded-xl bg-[#111827] border border-gray-800 shadow-sm relative overflow-hidden group hover:border-gray-700 transition">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Total Credits Recovered
            </p>
            <h3 className="text-2xl font-bold text-white mt-1">
              ${totalCreditsRecovered.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-400">
          <span className="text-cyan-400 font-medium">Stripe / Zendesk</span>
          <span>programmatically reconciled payouts</span>
        </div>
      </div>
    </div>
  );
};
