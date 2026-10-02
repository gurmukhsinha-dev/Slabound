"""
Unit tests for zkTelemetryProver Lambda
TKT-301, TKT-302, TKT-303
"""

import json
import pytest
from unittest.mock import patch, MagicMock

from backend.handlers.zk_telemetry_prover import (
    sha256_hash,
    compute_merkle_root,
    generate_zk_proof,
    lambda_handler
)


def test_sha256_hash():
    data = "test_string"
    digest = sha256_hash(data)
    assert len(digest) == 64
    assert digest == sha256_hash(data)


def test_merkle_root_calculation():
    leaves = [
        sha256_hash("ping_1_150ms"),
        sha256_hash("ping_2_160ms"),
        sha256_hash("ping_3_155ms"),
        sha256_hash("ping_4_140ms")
    ]
    root = compute_merkle_root(leaves)
    assert len(root) == 64
    # Deterministic check
    root2 = compute_merkle_root(leaves)
    assert root == root2


def test_generate_zk_proof_healthy_sla():
    latency_samples = [120.0, 130.5, 125.0, 140.0]
    proof = generate_zk_proof(
        vendor_id="stripe-payments-v1",
        endpoint="https://api.stripe.com/v1/charges",
        latency_samples_ms=latency_samples,
        threshold_ms=800.0,
        window_minutes=3
    )

    assert proof["status"] == "SLA_HEALTHY"
    assert proof["observed_avg_latency_ms"] < 800.0
    assert proof["zk_safeguard"]["raw_payload_included"] is False
    assert proof["zk_safeguard"]["pii_redacted"] is True
    assert "kms_signature" in proof
    assert len(proof["merkle_root"]) == 64


def test_generate_zk_proof_breach_detection():
    # Latencies breach 800ms threshold
    latency_samples = [920.0, 960.5, 940.0, 980.0]
    proof = generate_zk_proof(
        vendor_id="stripe-payments-v1",
        endpoint="https://api.stripe.com/v1/charges",
        latency_samples_ms=latency_samples,
        threshold_ms=800.0,
        window_minutes=3
    )

    assert proof["status"] == "BREACH_VERIFIED"
    assert proof["observed_avg_latency_ms"] > 800.0
    assert proof["consecutive_breach_count"] == 4
    assert proof["threshold_ms"] == 800.0


def test_lambda_handler_simulate_outage():
    event = {
        "body": json.dumps({
            "vendor_id": "stripe-payments-v1",
            "simulate_outage": True,
            "threshold_ms": 800
        })
    }
    response = lambda_handler(event, None)
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert "proof" in body
    assert body["proof"]["status"] == "BREACH_VERIFIED"
    assert body["proof"]["observed_avg_latency_ms"] > 900.0
