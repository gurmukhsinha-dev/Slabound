"""
Unit tests for Autonomous Arbitration Agent & Webhook Dispatcher
TKT-401, TKT-402
"""

import pytest
import asyncio
from unittest.mock import patch, MagicMock

from agent.webhook_dispatcher import DisputeWebhookDispatcher
from agent.agent import SLAArbitrationEngine


@pytest.fixture
def mock_zk_proof_breach():
    return {
        "proof_id": "zk-proof-stripe-payments-v1-1727784000",
        "vendor_id": "stripe-payments-v1",
        "endpoint_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "timestamp_window_start": 1727783820,
        "timestamp_window_end": 1727784000,
        "consecutive_breach_count": 3,
        "threshold_ms": 800.0,
        "observed_avg_latency_ms": 948.5,
        "merkle_root": "a8f5f167f44f4964e6c998dee827110c",
        "claim_digest": "7d9b9a67a07011d88bb447cbe3a7f80f",
        "kms_signature": "MOCK_SIGNATURE_BASE64",
        "signing_algorithm": "RSASSA_PKCS1_V1_5_SHA_256",
        "status": "BREACH_VERIFIED",
        "zk_safeguard": {
            "raw_payload_included": False,
            "pii_redacted": True
        }
    }


@pytest.fixture
def mock_zk_proof_healthy():
    return {
        "proof_id": "zk-proof-stripe-payments-v1-1727784000",
        "vendor_id": "stripe-payments-v1",
        "consecutive_breach_count": 0,
        "threshold_ms": 800.0,
        "observed_avg_latency_ms": 142.0,
        "status": "SLA_HEALTHY",
        "zk_safeguard": {
            "raw_payload_included": False,
            "pii_redacted": True
        }
    }


def test_dispatcher_payload_formatting(mock_zk_proof_breach):
    dispatcher = DisputeWebhookDispatcher(mock_mode=True)
    claim = {
        "arbitration_id": "arb-stripe-12345",
        "refund_amount_usd": 1250.00,
        "credit_percentage": 15.0
    }
    payload = dispatcher.format_stripe_dispute_payload(mock_zk_proof_breach, claim)

    assert "evidence" in payload
    assert payload["reason"] == "service_not_provided_as_agreed"
    assert "1,250.00" in payload["evidence"]["uncategorized_text"]
    assert "stripe-payments-v1" in payload["metadata"]["vendor_id"]


def test_dispatcher_dispatch_stripe_mock(mock_zk_proof_breach):
    dispatcher = DisputeWebhookDispatcher(mock_mode=True)
    claim = {
        "arbitration_id": "arb-stripe-12345",
        "refund_amount_usd": 1250.00,
        "credit_percentage": 15.0
    }
    res = dispatcher.dispatch_stripe_dispute(mock_zk_proof_breach, claim)

    assert res["status_code"] == 200
    assert res["amount_refunded_cents"] == 125000
    assert res["status"] == "won_and_credited"


def test_agent_evaluate_arbitration_rule_breach(mock_zk_proof_breach):
    engine = SLAArbitrationEngine()
    contract = {
        "vendor_id": "stripe-payments-v1",
        "latency_threshold_ms": 800.0,
        "window_minutes": 3,
        "credit_percentage": 15.0,
        "max_cap_usd": 2500.0
    }

    decision = engine.evaluate_arbitration_rule(mock_zk_proof_breach, contract)
    assert decision["is_breached"] is True
    assert decision["decision"] == "BREACH_UPHELD_REFUND_MANDATED"
    assert decision["refund_amount_usd"] == 1250.00  # 8333.33 * 0.15 = 1250.00
    assert decision["credit_percentage"] == 15.0


def test_agent_evaluate_arbitration_rule_healthy(mock_zk_proof_healthy):
    engine = SLAArbitrationEngine()
    contract = {
        "vendor_id": "stripe-payments-v1",
        "latency_threshold_ms": 800.0,
        "window_minutes": 3,
        "credit_percentage": 15.0,
        "max_cap_usd": 2500.0
    }

    decision = engine.evaluate_arbitration_rule(mock_zk_proof_healthy, contract)
    assert decision["is_breached"] is False
    assert decision["decision"] == "SLA_MET_NO_PENALTY"
    assert decision["refund_amount_usd"] == 0.0


@pytest.mark.asyncio
async def test_agent_full_breach_arbitration_flow(mock_zk_proof_breach):
    engine = SLAArbitrationEngine()
    result = await engine.process_proof(mock_zk_proof_breach)

    assert result is not None
    assert result["is_breached"] is True
    assert result["status"] == "DISPUTE_EXECUTED_CREDIT_RECOVERED"
    assert result["stripe_response"]["status_code"] == 200
    assert result["zendesk_response"]["status_code"] == 201
    assert result["refund_amount_usd"] == 1250.00
