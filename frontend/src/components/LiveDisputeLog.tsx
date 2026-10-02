'use client';

import React from 'react';
import { DisputeRecord } from '@/lib/mockData';
import { ShieldCheck, ArrowUpRight, CheckCircle2, Clock, FileCode } from 'lucide-react';

interface LiveDisputeLogProps {
  disputes: DisputeRecord[];
  onViewProof?: (proofId: string) => void;
}

export const LiveDisputeLog: React.FC<LiveDisputeLogProps> = ({ disputes, onViewProof }) => {
  return (
    <div className="p-6 rounded-xl bg-[#111827] border border-gray-800 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">Live Arbitration & Dispute Execution Log</h2>
          <p className="text-xs text-gray-400">
            Automated Stripe Dispute claims dispatched by Fargate Agent with signed zk-Proofs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-xs text-emerald-400 font-mono">Agent Loop Running</span>
        </div>
      </div>

      <div className="space-y-3">
        {disputes.map((dispute) => (
          <div
            key={dispute.id}
            className="p-4 rounded-lg bg-gray-900/60 border border-gray-800/80 hover:border-gray-700 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-white">{dispute.vendor_name}</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 bg-gray-800 text-gray-400 rounded">
                    {dispute.id}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded font-mono">
                    {dispute.observed_latency_ms}ms &gt; {dispute.threshold_ms}ms
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-1 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-gray-500" />
                    {dispute.timestamp}
                  </span>
                  <span className="text-gray-600">•</span>
                  <span>Merkle Root: <code className="text-indigo-300 font-mono">{dispute.merkle_root}</code></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <div className="text-sm font-bold text-cyan-400">
                  +${dispute.refund_amount_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-gray-400">Recovered Credit</div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" /> Stripe 200 OK
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-400">
                  KMS RSA-2048 Signed
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
