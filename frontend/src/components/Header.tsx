'use client';

import React from 'react';
import { Zap, ShieldCheck, RefreshCw, Bell } from 'lucide-react';

interface HeaderProps {
  onSimulateOutage: () => void;
  isSimulating: boolean;
  activeBreach: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onSimulateOutage,
  isSimulating,
  activeBreach,
}) => {
  return (
    <header className="h-16 border-b border-gray-800 bg-[#0B0F19]/90 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-white">SLA Arbitration Command Console</h1>
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          <span>Zero-Knowledge Telemetry Prover Active</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Interactive Outage Simulator Button from Header */}
        <button
          onClick={onSimulateOutage}
          disabled={isSimulating}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-xs transition-all shadow-md ${
            activeBreach
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/50 animate-pulse'
              : 'bg-gradient-to-r from-rose-500 to-amber-600 hover:from-rose-600 hover:to-amber-700 text-white shadow-rose-950/40 hover:scale-[1.02]'
          } ${isSimulating ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {isSimulating ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Synthesizing zk-Proof & Dispatching...</span>
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Simulate 900ms API Outage</span>
            </>
          )}
        </button>

        <div className="h-6 w-[1px] bg-gray-800" />

        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800">
            <span className="text-gray-500">KMS Key:</span>
            <span className="font-mono text-indigo-400">RSA-2048/SHA-256</span>
          </div>
        </div>
      </div>
    </header>
  );
};
