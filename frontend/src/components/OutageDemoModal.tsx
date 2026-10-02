'use client';

import React from 'react';
import { 
  X, 
  AlertTriangle, 
  ShieldCheck, 
  Cpu, 
  Key, 
  CheckCircle2, 
  DollarSign, 
  ExternalLink,
  ArrowRight
} from 'lucide-react';

interface OutageDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  step: 1 | 2 | 3 | 4;
  proofData: any;
  disputeData: any;
}

export const OutageDemoModal: React.FC<OutageDemoModalProps> = ({
  isOpen,
  onClose,
  step,
  proofData,
  disputeData,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111827] border border-gray-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-[#0E1422]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Autonomous SLA Dispute Arbitration</h3>
              <p className="text-xs text-gray-400">Real-time AWS Bedrock + KMS + Neptune Pipeline Execution</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: 3 Step Progress */}
        <div className="p-6 space-y-6">
          {/* Step 1: Latency Spiking */}
          <div className={`p-4 rounded-xl border transition-all ${
            step >= 1 ? 'border-rose-500/50 bg-rose-950/20' : 'border-gray-800 bg-gray-900/40'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400 text-xs">1</span>
                Synthetic Latency Breach Detected
              </span>
              <span className="text-xs font-mono text-rose-300 font-bold bg-rose-500/20 px-2 py-0.5 rounded">
                950ms (Threshold: 800ms)
              </span>
            </div>
            <p className="text-xs text-gray-300">
              CloudWatch synthetic canary detected 3 consecutive windows exceeding the contractual latency bounds for endpoint <code className="font-mono text-rose-300">/v1/charges</code>.
            </p>
          </div>

          {/* Step 2: zk-SNARK proof.json generation */}
          <div className={`p-4 rounded-xl border transition-all ${
            step >= 2 ? 'border-indigo-500/50 bg-indigo-950/20' : 'border-gray-800 bg-gray-900/40'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs">2</span>
                Cryptographic zk-Proof Generated & Signed via AWS KMS
              </span>
              {step >= 2 ? (
                <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> KMS Signed
                </span>
              ) : (
                <span className="text-xs font-mono text-gray-500">Pending...</span>
              )}
            </div>
            <p className="text-xs text-gray-300 mb-3">
              Synthesized SHA-256 Merkle root. No raw HTTP payload, headers, or PII exposed to vendor.
            </p>

            {step >= 2 && (
              <div className="bg-black/50 p-3 rounded-lg border border-gray-800 font-mono text-[11px] space-y-1 text-gray-300">
                <div className="flex justify-between">
                  <span className="text-gray-500">Proof ID:</span>
                  <span className="text-cyan-400">{proofData?.proof_id || 'zk-proof-stripe-payments-v1-now'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Merkle Root:</span>
                  <span className="text-indigo-400 truncate max-w-[280px]">
                    {proofData?.merkle_root || 'a8f5f167f44f4964e6c998dee827110c'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">KMS Key:</span>
                  <span className="text-emerald-400">alias/slabound-signing-key (RSA_2048)</span>
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Automated POST call to Stripe Disputes API */}
          <div className={`p-4 rounded-xl border transition-all ${
            step >= 3 ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-gray-800 bg-gray-900/40'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs">3</span>
                Automated Stripe Dispute POST Executed (200 OK)
              </span>
              {step >= 3 ? (
                <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded">
                  Status: 200 OK
                </span>
              ) : (
                <span className="text-xs font-mono text-gray-500">Waiting for proof...</span>
              )}
            </div>

            {step >= 3 ? (
              <div className="mt-3 p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    $1,250.00 USD Refund Claim Approved
                  </div>
                  <p className="text-xs text-emerald-300/80 mt-1">
                    Penalty ECA rule evaluated: 15% billing credit applied automatically to Stripe balance.
                  </p>
                </div>
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 font-semibold text-xs rounded-md border border-emerald-500/30">
                  Claim Credited
                </span>
              </div>
            ) : (
              <p className="text-xs text-gray-400">
                Awaiting cryptographic proof verification before dispatching external B2B claim webhook.
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-gray-800 bg-[#0E1422] flex items-center justify-between">
          <div className="text-xs text-gray-400 font-mono">
            SLABound Fargate Agent ID: <span className="text-indigo-400">task-slabound-arb-01</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium transition"
          >
            Close & Review Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
