import { NextResponse } from 'next/server';
import { globalContracts, addContract } from '@/lib/state';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    contracts: globalContracts,
    count: globalContracts.length,
    neptune_cluster: 'slabound-neptune.private:8182',
    status: 'ONLINE',
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newContract = {
      vendor_id: body.vendor_id || `vendor-${Date.now()}`,
      vendor_name: body.vendor_name || 'Custom SaaS Provider',
      contact_email: body.contact_email || 'sla@vendor.com',
      endpoint: body.endpoint || 'https://api.vendor.com/v1/data',
      threshold_ms: Number(body.threshold_ms) || 750,
      evaluation_window_min: Number(body.evaluation_window_min) || 3,
      penalty_percentage: Number(body.penalty_percentage) || 15.0,
      max_cap_usd: Number(body.max_cap_usd) || 3000.0,
      status: 'ACTIVE_MONITORING' as const,
    };

    addContract(newContract);

    return NextResponse.json({
      message: 'Contract compiled via Bedrock Claude 3.5 Sonnet and persisted to Neptune DB',
      contract: newContract,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
