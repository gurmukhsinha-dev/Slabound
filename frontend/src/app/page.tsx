'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Header } from '@/components/Header';
import { KpiCards } from '@/components/KpiCards';
import { TelemetryChart } from '@/components/TelemetryChart';
import { ActiveSlaTable } from '@/components/ActiveSlaTable';
import { LiveDisputeLog } from '@/components/LiveDisputeLog';
import { OutageDemoModal } from '@/components/OutageDemoModal';
import { INITIAL_CONTRACTS, INITIAL_DISPUTES, TelemetryPoint, DisputeRecord } from '@/lib/mockData';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DashboardPage() {
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryPoint[]>([
    { time: '17:00:00', latency: 138, threshold: 800, status: 'HEALTHY' },
    { time: '17:00:30', latency: 142, threshold: 800, status: 'HEALTHY' },
    { time: '17:01:00', latency: 136, threshold: 800, status: 'HEALTHY' },
    { time: '17:01:30', latency: 145, threshold: 800, status: 'HEALTHY' },
    { time: '17:02:00', latency: 140, threshold: 800, status: 'HEALTHY' },
    { time: '17:02:30', latency: 144, threshold: 800, status: 'HEALTHY' },
  ]);

  const [contracts] = useState(INITIAL_CONTRACTS);
  const [disputes, setDisputes] = useState<DisputeRecord[]>(INITIAL_DISPUTES);
  const [isSimulating, setIsSimulating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2 | 3 | 4>(1);
  const [proofData, setProofData] = useState<any>(null);
  const [disputeData, setDisputeData] = useState<any>(null);

  // Poll /api/telemetry every 3 seconds per Frontend Specification Document
  const { data: telemetryData } = useSWR('/api/telemetry', fetcher, {
    refreshInterval: 3000,
  });

  useEffect(() => {
    if (telemetryData && telemetryData.latency) {
      setTelemetryHistory((prev) => {
        const nextPoint: TelemetryPoint = {
          time: telemetryData.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          latency: telemetryData.latency,
          threshold: telemetryData.threshold || 800,
          status: telemetryData.latency > (telemetryData.threshold || 800) ? 'BREACH' : 'HEALTHY',
        };
        const updated = [...prev, nextPoint];
        return updated.slice(-14); // Keep last 14 data points for smooth line rendering
      });
    }
  }, [telemetryData]);

  // Compute live KPI metrics
  const latestLatency = telemetryHistory[telemetryHistory.length - 1]?.latency || 142.0;
  const isBreached = latestLatency > 800;
  const totalCredits = disputes.reduce((sum, d) => sum + d.refund_amount_usd, 0);

  // Trigger Outage Simulation (Step 1 -> Step 2 -> Step 3)
  const handleSimulateOutage = async () => {
    setIsSimulating(true);
    setModalStep(1);
    setModalOpen(true);

    try {
      const res = await fetch('/api/simulate-outage', { method: 'POST' });
      const data = await res.json();

      // Step 1: Immediate latency spike visible
      setTelemetryHistory((prev) => [
        ...prev.slice(-13),
        {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          latency: 955.5,
          threshold: 800,
          status: 'BREACH',
        },
      ]);

      // Step 2: Show zk-SNARK proof generation after 1.2 seconds
      setTimeout(() => {
        setModalStep(2);
        setProofData(data.step2_proof);

        // Step 3: Show automated Stripe webhook dispatch and $1,250 refund after 2.5 seconds
        setTimeout(() => {
          setModalStep(3);
          setDisputeData(data.step3_stripe);
          if (data.dispute_record) {
            setDisputes((prev) => [data.dispute_record, ...prev]);
          }
          setIsSimulating(false);
        }, 1400);
      }, 1200);
    } catch (err) {
      console.error('Outage simulation failed:', err);
      setIsSimulating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <Header
        onSimulateOutage={handleSimulateOutage}
        isSimulating={isSimulating}
        activeBreach={isBreached}
      />

      <div className="p-8 space-y-8 max-w-7xl w-full mx-auto">
        {/* KPI Cards Header */}
        <KpiCards
          activeVendorsCount={contracts.length}
          avgLatency={latestLatency}
          isBreached={isBreached}
          totalCreditsRecovered={totalCredits}
        />

        {/* Real-Time Telemetry Monitor */}
        <TelemetryChart
          data={telemetryHistory}
          threshold={800}
          isBreached={isBreached}
          vendorName="Stripe API (/v1/charges)"
        />

        {/* Active SLA Table */}
        <ActiveSlaTable contracts={contracts} />

        {/* Live Dispute Log */}
        <LiveDisputeLog disputes={disputes} />
      </div>

      {/* Outage Demo Modal */}
      <OutageDemoModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        step={modalStep}
        proofData={proofData}
        disputeData={disputeData}
      />
    </div>
  );
}
