'use client';

import React, { useState } from 'react';
import { LiveDisputeLog } from '@/components/LiveDisputeLog';
import { INITIAL_DISPUTES } from '@/lib/mockData';
import { ShieldCheck, DownloadCloud, FileCode } from 'lucide-react';

export default function DisputesPage() {
  const [disputes] = useState(INITIAL_DISPUTES);
  const [selectedProof, setSelectedProof] = useState<string | null>(null);

  return (
    <div className="p-8 max-w-7xl w-full mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dispute Arbitration History</h1>
          <p className="text-xs text-gray-400 mt-1">
            Audit trail of autonomous B2B dispute claims executed against Stripe Disputes API and Zendesk.
          </p>
        </div>
      </div>

      <LiveDisputeLog
        disputes={disputes}
        onViewProof={(id) => setSelectedProof(id)}
      />

      <div className="p-6 rounded-xl bg-[#111827] border border-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <FileCode className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-semibold text-white">Sample zk-SNARK Telemetry Proof Structure (proof.json)</h2>
        </div>
        <pre className="p-4 rounded-lg bg-black/60 border border-gray-800 font-mono text-xs text-emerald-400 overflow-x-auto">
{JSON.stringify(
  {
    "proof_id": "zk-proof-stripe-payments-v1-1727784000",
    "proof_version": "1.0-zk-snark",
    "vendor_id": "stripe-payments-v1",
    "endpoint_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "timestamp_window_start": 1727783820,
    "timestamp_window_end": 1727784000,
    "consecutive_breach_count": 3,
    "threshold_ms": 800.0,
    "observed_avg_latency_ms": 948.5,
    "merkle_root": "a8f5f167f44f4964e6c998dee827110c...",
    "claim_digest": "7d9b9a67a07011d88bb447cbe3a7f80f...",
    "kms_signature": "MEQCIFz...[base64 RSA_2048 cryptographically signed by AWS KMS]...",
    "signing_algorithm": "RSASSA_PKCS1_V1_5_SHA_256",
    "status": "BREACH_VERIFIED",
    "zk_safeguard": {
      "raw_payload_included": false,
      "pii_redacted": true,
      "cryptographic_proof_type": "SHA256_KMS_MERKLE_PROOF"
    }
  },
  null,
  2
)}
        </pre>
      </div>
    </div>
  );
}
