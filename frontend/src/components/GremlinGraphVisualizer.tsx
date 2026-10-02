'use client';

import React, { useState } from 'react';
import { Database, ArrowRight, Share2, Layers, Cpu, ShieldCheck } from 'lucide-react';

interface GremlinGraphVisualizerProps {
  vendorId?: string;
}

export const GremlinGraphVisualizer: React.FC<GremlinGraphVisualizerProps> = () => {
  const [selectedNode, setSelectedNode] = useState<'vendor' | 'clause' | 'penalty'>('clause');

  return (
    <div className="p-6 rounded-xl bg-[#111827] border border-gray-800 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white">Amazon Neptune DB Gremlin Graph View</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono">
              wss://neptune.cluster:8182
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Event-Condition-Action (ECA) vertices and directed edges compiled from Bedrock Claude 3.5 Sonnet
          </p>
        </div>
      </div>

      {/* Interactive Visual Graph Canvas */}
      <div className="bg-[#0A0E18] rounded-xl p-8 border border-gray-800 relative flex flex-col items-center justify-center min-h-[300px] overflow-hidden">
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:24px_24px]" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-8 w-full max-w-4xl">
          
          {/* Node 1: Vendor Vertex */}
          <div
            onClick={() => setSelectedNode('vendor')}
            className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 w-64 ${
              selectedNode === 'vendor'
                ? 'bg-indigo-950/40 border-indigo-500 shadow-lg shadow-indigo-500/20 scale-105'
                : 'bg-gray-900/80 border-gray-800 hover:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                Vertex: Vendor
              </span>
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-sm font-bold text-white">stripe-payments-v1</div>
            <div className="text-xs text-gray-400 mt-1">Stripe, Inc.</div>
            <div className="text-[11px] font-mono text-gray-500 mt-2 truncate">
              contact: disputes@stripe.com
            </div>
          </div>

          {/* Edge 1: HAS_CLAUSE */}
          <div className="flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-mono text-cyan-400 font-semibold px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800 mb-1">
              -[:HAS_CLAUSE]-&gt;
            </span>
            <div className="w-12 h-0.5 bg-gradient-to-r from-indigo-500 to-cyan-500 relative">
              <div className="absolute right-0 -top-1 w-2 h-2 border-t-2 border-r-2 border-cyan-500 rotate-45" />
            </div>
          </div>

          {/* Node 2: SLAClause Vertex */}
          <div
            onClick={() => setSelectedNode('clause')}
            className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 w-64 ${
              selectedNode === 'clause'
                ? 'bg-cyan-950/40 border-cyan-500 shadow-lg shadow-cyan-500/20 scale-105'
                : 'bg-gray-900/80 border-gray-800 hover:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                Vertex: SLAClause
              </span>
              <Cpu className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-sm font-bold text-white">clause-stripe-800ms</div>
            <div className="text-xs text-amber-400 font-mono mt-1">threshold: &gt; 800ms</div>
            <div className="text-[11px] text-gray-400 mt-1">window: 3 consecutive min</div>
            <div className="text-[10px] font-mono text-gray-500 mt-2 truncate">
              /v1/charges
            </div>
          </div>

          {/* Edge 2: TRIGGERS_PENALTY */}
          <div className="flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800 mb-1">
              -[:TRIGGERS_PENALTY]-&gt;
            </span>
            <div className="w-12 h-0.5 bg-gradient-to-r from-cyan-500 to-emerald-500 relative">
              <div className="absolute right-0 -top-1 w-2 h-2 border-t-2 border-r-2 border-emerald-500 rotate-45" />
            </div>
          </div>

          {/* Node 3: Penalty Vertex */}
          <div
            onClick={() => setSelectedNode('penalty')}
            className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 w-64 ${
              selectedNode === 'penalty'
                ? 'bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-500/20 scale-105'
                : 'bg-gray-900/80 border-gray-800 hover:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                Vertex: Penalty
              </span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-sm font-bold text-emerald-400">15.0% Billing Refund</div>
            <div className="text-xs text-gray-300 mt-1">Max Cap: $2,500.00 USD</div>
            <div className="text-[11px] text-gray-500 mt-2">
              Action: Programmatic Stripe Dispute
            </div>
          </div>
        </div>

        {/* Selected Node Gremlin JSON Inspector */}
        <div className="mt-8 w-full max-w-4xl p-3.5 bg-gray-950/90 rounded-lg border border-gray-800 font-mono text-xs">
          <div className="flex items-center justify-between mb-1.5 text-gray-400 text-[11px]">
            <span>Active Gremlin Traversal Query Result</span>
            <span className="text-indigo-400">g.V().hasLabel('{selectedNode === 'vendor' ? 'Vendor' : selectedNode === 'clause' ? 'SLAClause' : 'Penalty'}').valueMap()</span>
          </div>
          <pre className="text-gray-300 overflow-x-auto text-[11px] p-2 bg-black/40 rounded">
            {selectedNode === 'vendor' && JSON.stringify({
              "~label": "Vendor",
              "id": "stripe-payments-v1",
              "name": "Stripe, Inc.",
              "contact_email": "disputes@stripe.com"
            }, null, 2)}
            {selectedNode === 'clause' && JSON.stringify({
              "~label": "SLAClause",
              "id": "clause-stripe-800ms",
              "endpoint": "https://api.stripe.com/v1/charges",
              "latency_threshold_ms": 800,
              "window_minutes": 3
            }, null, 2)}
            {selectedNode === 'penalty' && JSON.stringify({
              "~label": "Penalty",
              "id": "penalty-stripe-15pct",
              "credit_percentage": 15.0,
              "max_cap_usd": 2500.0
            }, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};
