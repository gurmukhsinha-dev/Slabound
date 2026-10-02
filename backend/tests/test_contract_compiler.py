"""
Unit tests for ContractToECACompiler Lambda
TKT-201, TKT-202, TKT-203
"""

import json
import pytest
from unittest.mock import patch, MagicMock
from io import BytesIO

from backend.handlers.contract_compiler import (
    extract_sla_rules_with_bedrock,
    persist_to_neptune,
    lambda_handler
)

MOCK_CONTRACT_TEXT = """
Service Level Agreement - Stripe Payments API
Target Endpoint: https://api.stripe.com/v1/charges
Latency Bounds: Under 800ms
Evaluation Window: 3 consecutive minutes
Penalty: 15% billing credit refund
Maximum Cap: $2,500.00 USD
Contact: disputes@stripe.com
"""

MOCK_BEDROCK_RESPONSE = {
    "vendor_id": "stripe-payments-v1",
    "vendor_name": "Stripe, Inc.",
    "contact_email": "disputes@stripe.com",
    "endpoint": "https://api.stripe.com/v1/charges",
    "threshold_ms": 800,
    "evaluation_window_min": 3,
    "penalty_percentage": 15.0,
    "max_cap_usd": 2500.0
}


def test_extract_sla_rules_with_bedrock_success():
    with patch("backend.handlers.contract_compiler.bedrock_runtime.invoke_model") as mock_invoke:
        mock_body = MagicMock()
        mock_body.read.return_value = json.dumps({
            "content": [{"text": json.dumps(MOCK_BEDROCK_RESPONSE)}]
        }).encode("utf-8")
        mock_invoke.return_value = {"body": mock_body}

        rules = extract_sla_rules_with_bedrock(MOCK_CONTRACT_TEXT)
        assert rules["vendor_id"] == "stripe-payments-v1"
        assert rules["threshold_ms"] == 800
        assert rules["evaluation_window_min"] == 3
        assert rules["penalty_percentage"] == 15.0


def test_extract_sla_rules_with_bedrock_fallback_on_error():
    with patch("backend.handlers.contract_compiler.bedrock_runtime.invoke_model", side_effect=Exception("Bedrock API Error")):
        rules = extract_sla_rules_with_bedrock(MOCK_CONTRACT_TEXT)
        assert "vendor_id" in rules
        assert rules["threshold_ms"] == 800


def test_persist_to_neptune_structure():
    result = persist_to_neptune(MOCK_BEDROCK_RESPONSE)
    assert result["status"] == "GRAPH_PERSISTED"
    assert result["vendor"]["id"] == "stripe-payments-v1"
    assert result["clause"]["latency_threshold_ms"] == 800
    assert result["penalty"]["credit_percentage"] == 15.0
    assert len(result["relationships"]) == 2
    assert result["relationships"][0]["edge"] == "HAS_CLAUSE"
    assert result["relationships"][1]["edge"] == "TRIGGERS_PENALTY"


def test_lambda_handler_s3_event():
    s3_event = {
        "Records": [
            {
                "s3": {
                    "bucket": {"name": "slabound-contracts-incoming"},
                    "object": {"key": "vendor_agreements/stripe_sla_2026.pdf"}
                }
            }
        ]
    }

    with patch("backend.handlers.contract_compiler.s3_client.get_object") as mock_get_object:
        mock_get_object.return_value = {
            "Body": BytesIO(b"Sample SLA contract PDF data")
        }
        with patch("backend.handlers.contract_compiler.bedrock_runtime.invoke_model") as mock_invoke:
            mock_body = MagicMock()
            mock_body.read.return_value = json.dumps({
                "content": [{"text": json.dumps(MOCK_BEDROCK_RESPONSE)}]
            }).encode("utf-8")
            mock_invoke.return_value = {"body": mock_body}

            response = lambda_handler(s3_event, None)
            assert response["statusCode"] == 200
            body = json.loads(response["body"])
            assert "Successfully compiled" in body["message"]
            assert len(body["contracts"]) == 1
