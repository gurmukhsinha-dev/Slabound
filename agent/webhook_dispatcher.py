"""
SLABound - Autonomous Dispute Webhook Dispatcher
TKT-402

Constructs automated B2B dispute payloads containing cryptographic zk-SNARK proofs,
hashes, and mathematical refund claims, and dispatches them to external vendor billing
and ticketing APIs (Stripe Disputes API /v1/disputes, Zendesk Tickets API).
"""

import json
import logging
import time
from typing import Dict, Any, Optional
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("SLABoundWebhookDispatcher")


class DisputeWebhookDispatcher:
    def __init__(
        self,
        stripe_endpoint: str = "https://api.stripe.com/v1/disputes",
        zendesk_endpoint: str = "https://slabound.zendesk.com/api/v2/tickets.json",
        timeout_seconds: int = 10,
        mock_mode: bool = True
    ):
        self.stripe_endpoint = stripe_endpoint
        self.zendesk_endpoint = zendesk_endpoint
        self.timeout_seconds = timeout_seconds
        self.mock_mode = mock_mode

        # Resilient HTTP session with exponential backoff retries
        self.session = requests.Session()
        retries = Retry(
            total=3,
            backoff_factor=1.5,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["POST"]
        )
        self.session.mount("https://", HTTPAdapter(max_retries=retries))
        self.session.mount("http://", HTTPAdapter(max_retries=retries))

    def format_stripe_dispute_payload(
        self,
        proof: Dict[str, Any],
        dispute_claim: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Formats dispute claim payload matching Stripe Disputes API structure.
        """
        return {
            "evidence": {
                "uncategorized_text": (
                    f"Automated SLA Breach Dispute filed by SLABound Autonomous Engine. "
                    f"Vendor: {proof.get('vendor_id')}. "
                    f"Observed Latency: {proof.get('observed_avg_latency_ms')}ms "
                    f"(Threshold: {proof.get('threshold_ms')}ms). "
                    f"Calculated Refund Credit: ${dispute_claim.get('refund_amount_usd'):,.2f} USD."
                ),
                "customer_communication": f"Cryptographic zk-Proof ID: {proof.get('proof_id')}",
                "service_documentation": json.dumps({
                    "proof_id": proof.get("proof_id"),
                    "claim_digest": proof.get("claim_digest"),
                    "merkle_root": proof.get("merkle_root"),
                    "kms_signature": proof.get("kms_signature"),
                    "signing_algorithm": proof.get("signing_algorithm"),
                    "timestamp_window": {
                        "start": proof.get("timestamp_window_start"),
                        "end": proof.get("timestamp_window_end")
                    },
                    "zk_safeguard": proof.get("zk_safeguard")
                })
            },
            "reason": "service_not_provided_as_agreed",
            "metadata": {
                "slabound_arbitration_id": dispute_claim.get("arbitration_id"),
                "vendor_id": proof.get("vendor_id"),
                "credit_percentage": dispute_claim.get("credit_percentage"),
                "status": "AUTONOMOUS_CLAIM_SUBMITTED"
            }
        }

    def format_zendesk_ticket_payload(
        self,
        proof: Dict[str, Any],
        dispute_claim: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Formats B2B ticket for Zendesk Ticketing API.
        """
        return {
            "ticket": {
                "subject": f"[SLA BREACH CLAIM] {proof.get('vendor_id')} - Autonomous Refund Claim ${dispute_claim.get('refund_amount_usd'):,.2f}",
                "comment": {
                    "body": (
                        f"SLABound autonomous engine has detected an SLA breach according to contract ECA rules.\n\n"
                        f"Vendor ID: {proof.get('vendor_id')}\n"
                        f"Breach Latency: {proof.get('observed_avg_latency_ms')}ms (Threshold: {proof.get('threshold_ms')}ms)\n"
                        f"Consecutive Windows: {proof.get('consecutive_breach_count')}\n"
                        f"Penalty Credit Claimed: ${dispute_claim.get('refund_amount_usd'):,.2f} USD ({dispute_claim.get('credit_percentage')}%)\n\n"
                        f"Cryptographic Proof (Zero-Knowledge Telemetry):\n"
                        f"- Merkle Root: {proof.get('merkle_root')}\n"
                        f"- Claim Digest: {proof.get('claim_digest')}\n"
                        f"- KMS Signature: {proof.get('kms_signature')}\n\n"
                        f"No raw PII or payload bodies were exposed in this proof."
                    )
                },
                "priority": "urgent",
                "type": "problem",
                "tags": ["sla-breach", "slabound-autonomous", "financial-recovery"]
            }
        }

    def dispatch_stripe_dispute(
        self,
        proof: Dict[str, Any],
        dispute_claim: Dict[str, Any],
        api_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Dispatches dispute directly to Stripe Disputes API endpoint.
        """
        payload = self.format_stripe_dispute_payload(proof, dispute_claim)
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key or 'sk_test_slabound_mock_token'}"
        }

        logger.info(f"Dispatching Stripe dispute for {proof.get('vendor_id')} claim amount: ${dispute_claim.get('refund_amount_usd')}")

        if self.mock_mode:
            # Emulate 200 OK from Stripe Disputes API
            time.sleep(0.3)
            return {
                "status_code": 200,
                "dispute_id": f"dp_slabound_{int(time.time())}",
                "amount_refunded_cents": int(dispute_claim.get("refund_amount_usd", 1250.0) * 100),
                "currency": "usd",
                "status": "won_and_credited",
                "endpoint_target": self.stripe_endpoint,
                "response": {
                    "object": "dispute",
                    "status": "under_review",
                    "reason": "service_not_provided_as_agreed",
                    "refund_guaranteed": True
                }
            }

        try:
            resp = self.session.post(self.stripe_endpoint, json=payload, headers=headers, timeout=self.timeout_seconds)
            return {
                "status_code": resp.status_code,
                "response": resp.json() if resp.headers.get("content-type", "").startswith("application/json") else resp.text
            }
        except Exception as e:
            logger.error(f"Failed to post to Stripe endpoint: {str(e)}")
            return {"status_code": 500, "error": str(e)}

    def dispatch_zendesk_ticket(
        self,
        proof: Dict[str, Any],
        dispute_claim: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Dispatches incident ticket to Zendesk API.
        """
        payload = self.format_zendesk_ticket_payload(proof, dispute_claim)
        logger.info(f"Dispatching Zendesk ticket for {proof.get('vendor_id')}")

        if self.mock_mode:
            time.sleep(0.2)
            return {
                "status_code": 201,
                "ticket_id": 98421,
                "status": "open",
                "priority": "urgent"
            }

        try:
            resp = self.session.post(self.zendesk_endpoint, json=payload, timeout=self.timeout_seconds)
            return {"status_code": resp.status_code, "response": resp.text}
        except Exception as e:
            return {"status_code": 500, "error": str(e)}
