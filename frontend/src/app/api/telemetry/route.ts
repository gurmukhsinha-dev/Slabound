import { NextResponse } from 'next/server';
import { breachActive, decrementBreachCountdown } from '@/lib/state';

export const dynamic = 'force-dynamic';

export async function GET() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  let latency = 142.0;

  if (breachActive) {
    // Latency spike during simulated outage
    latency = 920.0 + Math.random() * 60; // 920ms - 980ms
    decrementBreachCountdown();
  } else {
    // Normal nominal jitter around 135-155ms
    latency = 135.0 + Math.random() * 20;
  }

  return NextResponse.json({
    timestamp: now.toISOString(),
    time: timeStr,
    vendor_id: 'stripe-payments-v1',
    endpoint: 'https://api.stripe.com/v1/charges',
    latency: Math.round(latency * 10) / 10,
    threshold: 800,
    status: latency > 800 ? 'BREACH' : 'HEALTHY',
    canary_status: 'RUNNING',
    prover_status: latency > 800 ? 'GENERATING_ZK_PROOF' : 'IDLE',
  });
}
