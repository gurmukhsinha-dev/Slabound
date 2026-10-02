'use client';

import React, { useState } from 'react';
import { TelemetryChart } from '@/components/TelemetryChart';
import { Activity, ShieldCheck, Cpu, HardDrive } from 'lucide-react';
import { TelemetryPoint } from '@/lib/mockData';

export default function TelemetryPage() {
  const [data] = useState<TelemetryPoint[]>([
    { time: '16:50:00', latency: 141, threshold: 800, status: 'HEALTHY' },
    { time: '16:52:00', latency: 139, threshold: 800, status: 'HEALTHY' },
    { time: '16:54:00', latency: 144, threshold: 800, status: 'HEALTHY' },
    { time: '16:56:00', latency: 140, threshold: 800, status: 'HEALTHY' },
    { time: '16:58:00', latency: 138, threshold: 800, status: 'HEALTHY' },
    { time: '17:00:00', latency: 145, threshold: 800, status: 'HEALTHY' },
  ]);

  return (
    <div className="p-8 max-w-7xl w-full mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Canary Telemetry & zk-Prover Monitor</h1>
        <p className="text-xs text-gray-400 mt-1">
          Real-time CloudWatch Synthetics canary streams, SHA-256 Merkle tree verification, and AWS KMS payload signatures.
        </p>
      </div>

      <TelemetryChart
        data={data}
        threshold={800}
        isBreached={false}
        vendorName="CloudWatch Synthetics Canary Stream (Active)"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 rounded-xl bg-[#111827] border border-gray-800">
          <div className="flex items-center gap-2 text-indigo-400 mb-2">
            <Cpu className="w-5 h-5" />
            <h3 className="font-semibold text-sm text-white">Zero-Knowledge Safeguard</h3>
          </div>
          <p className="text-xs text-gray-400">
            Complies with AWS Security Pillar. Telemetry payloads contain ONLY hashed execution paths, cryptographic signatures, and timestamps.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#111827] border border-gray-800">
          <div className="flex items-center gap-2 text-cyan-400 mb-2">
            <HardDrive className="w-5 h-5" />
            <h3 className="font-semibold text-sm text-white">Merkle Tree Aggregation</h3>
          </div>
          <p className="text-xs text-gray-400">
            Raw pings are converted to SHA-256 leaf hashes, folded into a deterministic root, preserving privacy while guaranteeing mathematical proof.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#111827] border border-gray-800">
          <div className="flex items-center gap-2 text-emerald-400 mb-2">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="font-semibold text-sm text-white">AWS KMS Signing</h3>
          </div>
          <p className="text-xs text-gray-400">
            Every breach claim digest is signed using Asymmetric RSA_2048 (<code className="font-mono text-emerald-300">alias/slabound-signing-key</code>).
          </p>
        </div>
      </div>
    </div>
  );
}
