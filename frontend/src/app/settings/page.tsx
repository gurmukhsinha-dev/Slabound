'use client';

import React from 'react';
import { Settings, ShieldCheck, Key, Cpu, Database, Cloud } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="p-8 max-w-7xl w-full mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">System Configuration & AWS Integration</h1>
        <p className="text-xs text-gray-400 mt-1">
          AWS CDK managed resource connections, cryptographic signing keys, and LLM inference endpoints.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl bg-[#111827] border border-gray-800 space-y-4">
          <div className="flex items-center gap-2 text-indigo-400">
            <Cpu className="w-5 h-5" />
            <h2 className="text-base font-semibold text-white">Amazon Bedrock LLM Configuration</h2>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between p-3 rounded-lg bg-gray-900 border border-gray-800">
              <span className="text-gray-400">Model ID:</span>
              <span className="font-mono text-white">anthropic.claude-3-5-sonnet-20240620-v1:0</span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-gray-900 border border-gray-800">
              <span className="text-gray-400">Target Region:</span>
              <span className="font-mono text-white">us-east-1</span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-gray-900 border border-gray-800">
              <span className="text-gray-400">JSON Schema Mode:</span>
              <span className="font-mono text-emerald-400">Enforced ECA Structured Output</span>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-[#111827] border border-gray-800 space-y-4">
          <div className="flex items-center gap-2 text-cyan-400">
            <Database className="w-5 h-5" />
            <h2 className="text-base font-semibold text-white">Amazon Neptune Graph Cluster</h2>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between p-3 rounded-lg bg-gray-900 border border-gray-800">
              <span className="text-gray-400">Cluster Status:</span>
              <span className="text-emerald-400 font-semibold">Available (Encrypted)</span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-gray-900 border border-gray-800">
              <span className="text-gray-400">Query Protocol:</span>
              <span className="font-mono text-white">Apache TinkerPop Gremlin (8182)</span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-gray-900 border border-gray-800">
              <span className="text-gray-400">VPC Isolation:</span>
              <span className="font-mono text-cyan-400">Private Subnets + NAT Egress</span>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-[#111827] border border-gray-800 space-y-4">
          <div className="flex items-center gap-2 text-rose-400">
            <Key className="w-5 h-5" />
            <h2 className="text-base font-semibold text-white">AWS KMS Cryptographic Key</h2>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between p-3 rounded-lg bg-gray-900 border border-gray-800">
              <span className="text-gray-400">Key Alias:</span>
              <span className="font-mono text-white">alias/slabound-signing-key</span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-gray-900 border border-gray-800">
              <span className="text-gray-400">Key Spec:</span>
              <span className="font-mono text-white">RSA_2048 (SIGN_VERIFY)</span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-gray-900 border border-gray-800">
              <span className="text-gray-400">Signing Algorithm:</span>
              <span className="font-mono text-emerald-400">RSASSA_PKCS1_V1_5_SHA_256</span>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-[#111827] border border-gray-800 space-y-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <Cloud className="w-5 h-5" />
            <h2 className="text-base font-semibold text-white">Amazon ECS Fargate Agent</h2>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between p-3 rounded-lg bg-gray-900 border border-gray-800">
              <span className="text-gray-400">Task Definition:</span>
              <span className="font-mono text-white">SLAArbitrationAgent:1</span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-gray-900 border border-gray-800">
              <span className="text-gray-400">Execution Runtime:</span>
              <span className="font-mono text-white">Python 3.11 Asyncio Event Loop</span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-gray-900 border border-gray-800">
              <span className="text-gray-400">Dispute Webhooks:</span>
              <span className="font-mono text-emerald-400">Stripe /v1/disputes + Zendesk</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
