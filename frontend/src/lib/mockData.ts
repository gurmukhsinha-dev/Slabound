export interface VendorContract {
  vendor_id: string;
  vendor_name: string;
  contact_email: string;
  endpoint: string;
  threshold_ms: number;
  evaluation_window_min: number;
  penalty_percentage: number;
  max_cap_usd: number;
  status: 'ACTIVE_MONITORING' | 'BREACHED' | 'DISPUTED';
}

export interface TelemetryPoint {
  time: string;
  latency: number;
  threshold: number;
  status: 'HEALTHY' | 'BREACH';
}

export interface DisputeRecord {
  id: string;
  timestamp: string;
  vendor_id: string;
  vendor_name: string;
  observed_latency_ms: number;
  threshold_ms: number;
  consecutive_windows: number;
  refund_amount_usd: number;
  proof_id: string;
  merkle_root: string;
  kms_signature_status: 'VERIFIED' | 'PENDING';
  stripe_webhook_status: '200_OK_CREDITED' | 'PROCESSING';
}

export const INITIAL_CONTRACTS: VendorContract[] = [
  {
    vendor_id: 'stripe-payments-v1',
    vendor_name: 'Stripe, Inc.',
    contact_email: 'sla-disputes@stripe.com',
    endpoint: 'https://api.stripe.com/v1/charges',
    threshold_ms: 800,
    evaluation_window_min: 3,
    penalty_percentage: 15.0,
    max_cap_usd: 2500.0,
    status: 'ACTIVE_MONITORING',
  },
  {
    vendor_id: 'twilio-messaging-v2',
    vendor_name: 'Twilio Communications',
    contact_email: 'sla@twilio.com',
    endpoint: 'https://api.twilio.com/2010-04-01/Messages.json',
    threshold_ms: 600,
    evaluation_window_min: 5,
    penalty_percentage: 20.0,
    max_cap_usd: 1500.0,
    status: 'ACTIVE_MONITORING',
  },
  {
    vendor_id: 'auth0-identity-v1',
    vendor_name: 'Okta / Auth0 Identity',
    contact_email: 'enterprise-sla@auth0.com',
    endpoint: 'https://auth.company.com/oauth/token',
    threshold_ms: 500,
    evaluation_window_min: 2,
    penalty_percentage: 10.0,
    max_cap_usd: 2000.0,
    status: 'ACTIVE_MONITORING',
  },
  {
    vendor_id: 'openai-inference-v1',
    vendor_name: 'OpenAI Enterprise',
    contact_email: 'sla@openai.com',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    threshold_ms: 1200,
    evaluation_window_min: 4,
    penalty_percentage: 25.0,
    max_cap_usd: 5000.0,
    status: 'ACTIVE_MONITORING',
  },
];

export const INITIAL_DISPUTES: DisputeRecord[] = [
  {
    id: 'arb-stripe-prev-8921',
    timestamp: '2026-09-28 14:22:10 UTC',
    vendor_id: 'stripe-payments-v1',
    vendor_name: 'Stripe, Inc.',
    observed_latency_ms: 912.4,
    threshold_ms: 800,
    consecutive_windows: 3,
    refund_amount_usd: 1250.0,
    proof_id: 'zk-proof-stripe-payments-v1-1727533330',
    merkle_root: '9f82d1c6e4a2...b412',
    kms_signature_status: 'VERIFIED',
    stripe_webhook_status: '200_OK_CREDITED',
  },
  {
    id: 'arb-twilio-prev-4190',
    timestamp: '2026-09-24 09:15:44 UTC',
    vendor_id: 'twilio-messaging-v2',
    vendor_name: 'Twilio Communications',
    observed_latency_ms: 742.0,
    threshold_ms: 600,
    consecutive_windows: 5,
    refund_amount_usd: 1500.0,
    proof_id: 'zk-proof-twilio-messaging-v2-1727169344',
    merkle_root: '7a11e892c5d1...f809',
    kms_signature_status: 'VERIFIED',
    stripe_webhook_status: '200_OK_CREDITED',
  },
  {
    id: 'arb-auth0-prev-1205',
    timestamp: '2026-09-18 18:04:12 UTC',
    vendor_id: 'auth0-identity-v1',
    vendor_name: 'Okta / Auth0 Identity',
    observed_latency_ms: 680.5,
    threshold_ms: 500,
    consecutive_windows: 2,
    refund_amount_usd: 2100.0,
    proof_id: 'zk-proof-auth0-identity-v1-1726682652',
    merkle_root: '3c44f129aa50...228a',
    kms_signature_status: 'VERIFIED',
    stripe_webhook_status: '200_OK_CREDITED',
  },
];
