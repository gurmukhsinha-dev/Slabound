# SLABound: Autonomous API SLA Arbitration Engine

[![AWS CDK v2](https://img.shields.io/badge/AWS%20CDK-v2.147.0-orange?logo=amazon-aws)](https://aws.amazon.com/cdk/)
[![Amazon Bedrock](https://img.shields.io/badge/Amazon%20Bedrock-Claude%203.5%20Sonnet-purple)](https://aws.amazon.com/bedrock/)
[![Amazon Neptune](https://img.shields.io/badge/Amazon%20Neptune-Gremlin%20Graph%20DB-blue)](https://aws.amazon.com/neptune/)
[![zk-SNARK Telemetry](https://img.shields.io/badge/Telemetry-zk--Proof%20%2B%20KMS-green)](https://aws.amazon.com/kms/)
[![Next.js 14](https://img.shields.io/badge/Next.js-14%20App%20Router-black?logo=next.js)](https://nextjs.org/)

SLABound is an autonomous agentic platform that monitors 3rd-party API dependencies, parses vendor legal contracts into executable state graphs, cryptographically verifies SLA breaches via Zero-Knowledge (zk) Telemetry Proofs, and programmatically executes automated financial dispute refunds.

---

## Architecture Overview

```
[ Vendor SLA PDF ]
       │
       ▼ (S3 Event Notification: s3:ObjectCreated:*.pdf)
[ AWS Lambda: ContractToECACompiler ] ───► [ Amazon Bedrock: Claude 3.5 Sonnet ]
       │                                            (Extracts ECA Rules)
       ▼ (Gremlin Writes)
[ Amazon Neptune DB ] (Graph Model: Vendor -> HAS_CLAUSE -> SLAClause -> TRIGGERS_PENALTY -> Penalty)
       ▲
       │ (Rule Queries)
[ AWS Lambda: zkTelemetryProver ] ◄─── [ CloudWatch Synthetics Canaries ]
       │ (KMS Sign Proofs)
       ▼ (Dispatches signed proof.json)
[ Amazon ECS Fargate: SLAArbitrationAgent ]
       │
       ▼ (POST Webhook: Automated B2B Dispute Claim)
[ Stripe Disputes API (/v1/disputes) / Zendesk Tickets API ]
```

---

## Repository Structure

```
slabound/
├── bin/
│   └── app.ts                      # CDK Application Entry Point
├── lib/
│   └── slabound-stack.ts           # Complete AWS CDK v2 TypeScript Infrastructure Stack
├── backend/
│   ├── handlers/
│   │   ├── contract_compiler.py    # S3 + Bedrock Claude 3.5 Sonnet + Neptune Gremlin
│   │   └── zk_telemetry_prover.py  # SHA-256 Merkle Proof + AWS KMS RSA_2048 Signing
│   ├── tests/
│   │   ├── test_contract_compiler.py
│   │   └── test_zk_telemetry_prover.py
│   └── requirements.txt
├── agent/
│   ├── agent.py                    # ECS Fargate Asyncio Agent Loop & ECA Evaluation
│   ├── webhook_dispatcher.py       # Programmatic B2B Dispute Claims (Stripe & Zendesk)
│   ├── Dockerfile                  # Production-grade Fargate Container
│   ├── tests/
│   │   └── test_arbitration_agent.py
│   └── requirements.txt
├── frontend/                       # Next.js 14 Developer Console & Interactive Pitch UI
│   ├── src/app/                    # App Router pages and API endpoints
│   ├── src/components/             # Recharts monitor, Gremlin visualizer, Outage simulator
│   └── package.json
├── package.json                    # Root CDK package
├── tsconfig.json
├── cdk.json
└── README.md
```

---

## Phase 1: AWS CDK Infrastructure Deployment

### Prerequisites
- AWS CLI configured with administrator credentials
- Node.js 18+ and npm
- Python 3.11+
- AWS CDK CLI (`npm install -g aws-cdk`)

### Step-by-Step Deployment Commands

```bash
# 1. Install CDK dependencies
npm install

# 2. Build TypeScript definitions
npm run build

# 3. Bootstrap your AWS Account/Region (first-time only)
npx cdk bootstrap aws://<YOUR_AWS_ACCOUNT_ID>/us-east-1

# 4. Synthesize CloudFormation template to verify resources
npx cdk synth

# 5. Deploy SLABound Stack to AWS
npx cdk deploy --require-approval never
```

---

## Phase 2: Running Backend & Agent Unit Tests

All 14 unit test suites cover contract parsing, Gremlin graph formatting, zk-proof synthesis, Merkle root generation, rule arbitration, and webhook dispatching:

```bash
# Install test requirements
pip install -r backend/requirements.txt
pip install -r agent/requirements.txt

# Run full test suite
python -m pytest backend/tests agent/tests -v
```

---

## Phase 3: Autonomous Arbitration Agent (ECS Fargate)

The agent runs as an isolated container in private subnets with NAT Gateway egress:

```bash
# Build Docker container locally
cd agent
docker build -t slabound-arbitration-agent:latest .

# Run agent locally in mock mode
python -m agent.agent
```

---

## Phase 4: Developer Console & Interactive Pitch Demo

### Running the Next.js 14 Console Locally

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000` to interact with:
1. **Dashboard KPI Header**: Live SLA count, real-time health status, and accumulated recovered credits ($USD).
2. **Real-Time Telemetry Monitor**: Recharts LineChart displaying 30s canary pings against dynamic contract breach thresholds.
3. **Interactive Outage Simulation Demo**: Click the **[ Simulate 900ms API Outage ]** button in the header to trigger:
   - **Step 1**: UI latency graph spikes to 955ms (breaching 800ms limit).
   - **Step 2**: Generates and displays cryptographic `proof.json` signed via AWS KMS with SHA-256 Merkle root.
   - **Step 3**: Dispatches automated dispute to Stripe API, returning `200 OK` and a **$1,250.00 USD** instant refund credit.
4. **Interactive Gremlin Graph Visualizer**: Inspect the ECA relationship graph (`Vendor` -> `HAS_CLAUSE` -> `SLAClause` -> `TRIGGERS_PENALTY` -> `Penalty`) at `/contracts`.

### Deploying Frontend to AWS Amplify or Vercel

```bash
# Single-command Vercel deployment:
cd frontend
npx vercel deploy --prod

# Single-command AWS Amplify deployment:
cd frontend
npx amplify publish
```
