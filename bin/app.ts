#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SLABoundStack } from '../lib/slabound-stack';

const app = new cdk.App();

const env = process.env.CDK_DEFAULT_ACCOUNT
  ? {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
    }
  : undefined;

new SLABoundStack(app, 'SLABoundStack', {
  stackName: 'slabound-arbitration-engine',
  description: 'SLABound: Autonomous API SLA Arbitration Engine (AWS Bedrock, Neptune, Lambda, ECS Fargate)',
  env,
  tags: {
    Project: 'SLABound',
    Environment: 'Production',
    ManagedBy: 'AWS-CDK',
  },
});

app.synth();
