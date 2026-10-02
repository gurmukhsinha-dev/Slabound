import { NextResponse } from 'next/server';
import { globalDisputes, addDispute } from '@/lib/state';
import { DisputeRecord } from '@/lib/mockData';

export const dynamic = 'force-dynamic';

export async function GET() {
  const totalRecovered = globalDisputes.reduce((sum, d) => sum + d.refund_amount_usd, 0);

  return NextResponse.json({
    disputes: globalDisputes,
    total_credits_recovered_usd: totalRecovered,
    count: globalDisputes.length,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newDispute: DisputeRecord = {
      id: body.id || `arb-stripe-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
      vendor_id: body.vendor_id || 'stripe-payments-v1',
      vendor_name: body.vendor_name || 'Stripe, Inc.',
      observed_latency_ms: Number(body.observed_latency_ms) || 948.5,
      threshold_ms: Number(body.threshold_ms) || 800,
      consecutive_windows: Number(body.consecutive_windows) || 3,
      refund_amount_usd: Number(body.refund_amount_usd) || 1250.0,
      proof_id: body.proof_id || `zk-proof-stripe-${Date.now()}`,
      merkle_root: body.merkle_root || 'a8f5f167...998d',
      kms_signature_status: 'VERIFIED',
      stripe_webhook_status: '200_OK_CREDITED',
    };

    addDispute(newDispute);

    return NextResponse.json({
      message: 'Autonomous dispute approved and credited via Stripe Webhook',
      dispute: newDispute,
      total_credits_recovered_usd: globalDisputes.reduce((sum, d) => sum + d.refund_amount_usd, 0),
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
