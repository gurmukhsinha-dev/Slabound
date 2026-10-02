import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3notifications from 'aws-cdk-lib/aws-s3-notifications';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as neptune from 'aws-cdk-lib/aws-neptune';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as path from 'path';
import * as fs from 'fs';

function resolvePath(relativeToRoot: string): string {
  const p1 = path.resolve(__dirname, '..', relativeToRoot);
  if (fs.existsSync(p1)) return p1;
  const p2 = path.resolve(__dirname, '../..', relativeToRoot);
  if (fs.existsSync(p2)) return p2;
  return p1;
}

export class SLABoundStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly contractsBucket: s3.Bucket;
  public readonly signingKey: kms.Key;
  public readonly neptuneCluster: neptune.CfnDBCluster;
  public readonly contractCompilerLambda: lambda.Function;
  public readonly zkTelemetryProverLambda: lambda.Function;
  public readonly fargateTaskDefinition: ecs.FargateTaskDefinition;
  public readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const region = this.region || 'us-east-1';
    const account = this.account || '*';

    // =========================================================================
    // 1. Networking: Isolated VPC (2 Public, 2 Private Subnets across 2 AZs)
    // =========================================================================
    this.vpc = new ec2.Vpc(this, 'SLABoundVPC', {
      maxAzs: 2,
      natGateways: 1, // High availability with cost-efficiency for dev/prod
      subnetConfiguration: [
        {
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'PrivateSubnet',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    // =========================================================================
    // 2. Security Groups
    // =========================================================================
    const neptuneSecurityGroup = new ec2.SecurityGroup(this, 'NeptuneSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: 'slabound-neptune-access',
      description: 'Security group isolating Amazon Neptune Graph DB cluster',
      allowAllOutbound: false,
    });

    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: 'slabound-lambda-access',
      description: 'Security group for SLABound Lambda functions',
      allowAllOutbound: true,
    });

    const fargateSecurityGroup = new ec2.SecurityGroup(this, 'FargateSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: 'slabound-fargate-access',
      description: 'Security group for SLABound Fargate Arbitration Agent',
      allowAllOutbound: true,
    });

    // Allow Gremlin port (8182) ingress to Neptune from Lambda and Fargate
    neptuneSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(8182),
      'Allow Gremlin traffic from Lambda Compiler'
    );
    neptuneSecurityGroup.addIngressRule(
      fargateSecurityGroup,
      ec2.Port.tcp(8182),
      'Allow Gremlin traffic from Fargate Arbitration Agent'
    );

    // =========================================================================
    // 3. Cryptographic KMS Signing Key for zk-SNARK Telemetry Proofs
    // =========================================================================
    this.signingKey = new kms.Key(this, 'SLABoundSigningKey', {
      keySpec: kms.KeySpec.RSA_2048,
      keyUsage: kms.KeyUsage.SIGN_VERIFY,
      description: 'Asymmetric RSA_2048 key for cryptographic signing of zk-SNARK telemetry proofs',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      alias: 'alias/slabound-signing-key',
    });

    // =========================================================================
    // 4. S3 Bucket for Incoming SLA Contracts
    // =========================================================================
    this.contractsBucket = new s3.Bucket(this, 'ContractsBucket', {
      bucketName: `slabound-contracts-${account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // =========================================================================
    // 5. Amazon Neptune Graph Database (Gremlin Server)
    // Conditional: Enabled on upgraded accounts (DEPLOY_NEPTUNE=true).
    // Bypassed on AWS Free Plan accounts where Neptune is restricted by AWS.
    // =========================================================================
    const deployNeptune = process.env.DEPLOY_NEPTUNE === 'true';
    let neptuneEndpoint = 'mock-neptune.slabound.local';

    if (deployNeptune) {
      const neptuneSubnetGroup = new neptune.CfnDBSubnetGroup(this, 'NeptuneSubnetGroup', {
        dbSubnetGroupDescription: 'Private Subnets for Neptune Cluster',
        subnetIds: this.vpc.privateSubnets.map((s) => s.subnetId),
        dbSubnetGroupName: `slabound-neptune-subnets-${account}`,
      });

      this.neptuneCluster = new neptune.CfnDBCluster(this, 'NeptuneCluster', {
        dbSubnetGroupName: neptuneSubnetGroup.dbSubnetGroupName,
        vpcSecurityGroupIds: [neptuneSecurityGroup.securityGroupId],
        iamAuthEnabled: true,
        storageEncrypted: true,
        deletionProtection: false,
      });
      this.neptuneCluster.addResourceDependency(neptuneSubnetGroup);

      const neptuneInstance = new neptune.CfnDBInstance(this, 'NeptuneInstance', {
        dbClusterIdentifier: this.neptuneCluster.ref,
        dbInstanceClass: 'db.t3.medium',
        autoMinorVersionUpgrade: true,
      });
      neptuneInstance.addResourceDependency(this.neptuneCluster);

      neptuneEndpoint = this.neptuneCluster.attrEndpoint;
    }

    // =========================================================================
    // 6. ContractToECACompiler Lambda Function
    // =========================================================================
    const contractCompilerRole = new iam.Role(this, 'ContractCompilerLambdaRole', {
      roleName: 'ContractCompilerLambdaRole',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });

    // Least Privilege IAM per Security & Access Document:
    // s3:GetObject on arn:aws:s3:::slabound-contracts-incoming/*
    contractCompilerRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [`${this.contractsBucket.bucketArn}/*`],
      })
    );

    // bedrock:InvokeModel on arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet*
    contractCompilerRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet*`,
        ],
      })
    );

    // neptune-db:connect on arn:aws:neptune-db:us-east-1:*:*/*
    contractCompilerRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['neptune-db:connect', 'neptune-db:WriteData'],
        resources: [`arn:aws:neptune-db:${region}:${account}:*/*`],
      })
    );

    this.contractCompilerLambda = new lambda.Function(this, 'ContractToECACompiler', {
      functionName: 'ContractToECACompiler',
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'contract_compiler.lambda_handler',
      code: lambda.Code.fromAsset(resolvePath('backend/handlers')),
      role: contractCompilerRole,
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSecurityGroup],
      timeout: cdk.Duration.seconds(60),
      memorySize: 1024,
      environment: {
        NEPTUNE_ENDPOINT: neptuneEndpoint,
        NEPTUNE_PORT: '8182',
        BEDROCK_MODEL_ID: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
    });

    // S3 Event Notification: Trigger Lambda upon PDF upload
    this.contractsBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3notifications.LambdaDestination(this.contractCompilerLambda),
      { suffix: '.pdf' }
    );

    // =========================================================================
    // 7. zkTelemetryProver Lambda Function
    // =========================================================================
    const zkTelemetryProverRole = new iam.Role(this, 'zkTelemetryProverLambdaRole', {
      roleName: 'zkTelemetryProverLambdaRole',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Least Privilege IAM per Security & Access Document:
    // cloudwatch:GetMetricData
    zkTelemetryProverRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['cloudwatch:GetMetricData'],
        resources: ['*'],
      })
    );

    // kms:Sign, kms:GetPublicKey on arn:aws:kms:us-east-1:*:key/slabound-signing-key
    zkTelemetryProverRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['kms:Sign', 'kms:GetPublicKey'],
        resources: [this.signingKey.keyArn],
      })
    );

    this.zkTelemetryProverLambda = new lambda.Function(this, 'zkTelemetryProver', {
      functionName: 'zkTelemetryProver',
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'zk_telemetry_prover.lambda_handler',
      code: lambda.Code.fromAsset(resolvePath('backend/handlers')),
      role: zkTelemetryProverRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        KMS_KEY_ID: this.signingKey.keyId,
        KMS_KEY_ARN: this.signingKey.keyArn,
        METRIC_NAMESPACE: 'SLABound/Synthetics',
        WINDOW_SIZE_MINUTES: '3',
      },
    });

    // =========================================================================
    // 8. Amazon ECS Fargate Task Definition: SLAArbitrationAgent
    // =========================================================================
    const ecsCluster = new ecs.Cluster(this, 'SLABoundECSCluster', {
      vpc: this.vpc,
      clusterName: 'slabound-arbitration-cluster',
    });

    const fargateTaskRole = new iam.Role(this, 'FargateArbitrationAgentRole', {
      roleName: 'FargateArbitrationAgentRole',
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Least Privilege IAM per Security & Access Document:
    // neptune-db:ReadDataAccess
    fargateTaskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['neptune-db:ReadDataAccess', 'neptune-db:connect'],
        resources: [`arn:aws:neptune-db:${region}:${account}:*/*`],
      })
    );

    // secretsmanager:GetSecretValue on arn:aws:secretsmanager:*:*:secret:slabound/vendor-keys-*
    fargateTaskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [`arn:aws:secretsmanager:${region}:${account}:secret:slabound/vendor-keys-*`],
      })
    );

    this.fargateTaskDefinition = new ecs.FargateTaskDefinition(this, 'SLAArbitrationAgentTask', {
      family: 'SLAArbitrationAgent',
      cpu: 512,
      memoryLimitMiB: 1024,
      taskRole: fargateTaskRole,
    });

    const containerImage = process.env.BUILD_DOCKER_ASSET === 'true'
      ? ecs.ContainerImage.fromAsset(resolvePath('agent'))
      : ecs.ContainerImage.fromRegistry('public.ecr.aws/docker/library/python:3.11-slim');

    this.fargateTaskDefinition.addContainer('ArbitrationAgentContainer', {
      image: containerImage,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'sla-arbitration-agent' }),
      environment: {
        NEPTUNE_ENDPOINT: neptuneEndpoint,
        NEPTUNE_PORT: '8182',
        KMS_KEY_ID: this.signingKey.keyId,
        STRIPE_DISPUTES_ENDPOINT: 'https://api.stripe.com/v1/disputes',
        ZENDESK_TICKETS_ENDPOINT: 'https://slabound.zendesk.com/api/v2/tickets.json',
      },
    });

    // =========================================================================
    // 9. API Gateway HTTP API
    // =========================================================================
    this.httpApi = new apigwv2.HttpApi(this, 'SLABoundHttpApi', {
      apiName: 'SLABound API',
      description: 'API Gateway for SLABound Contracts, Telemetry, and Disputes',
      corsPreflight: {
        allowHeaders: ['Authorization', 'Content-Type', 'x-api-key'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'],
        maxAge: cdk.Duration.days(1),
      },
    });

    const zkIntegration = new apigwv2_integrations.HttpLambdaIntegration(
      'zkProverIntegration',
      this.zkTelemetryProverLambda
    );

    const compilerIntegration = new apigwv2_integrations.HttpLambdaIntegration(
      'compilerIntegration',
      this.contractCompilerLambda
    );

    // Endpoints: /api/contracts, /api/telemetry, /api/disputes
    this.httpApi.addRoutes({
      path: '/api/contracts',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: compilerIntegration,
    });

    this.httpApi.addRoutes({
      path: '/api/telemetry',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: zkIntegration,
    });

    this.httpApi.addRoutes({
      path: '/api/disputes',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: zkIntegration,
    });

    // =========================================================================
    // 10. Stack Outputs
    // =========================================================================
    new cdk.CfnOutput(this, 'ContractsBucketName', {
      value: this.contractsBucket.bucketName,
      description: 'S3 Bucket for incoming vendor SLA contracts',
    });

    new cdk.CfnOutput(this, 'NeptuneEndpoint', {
      value: neptuneEndpoint,
      description: 'Amazon Neptune Gremlin Endpoint',
    });

    new cdk.CfnOutput(this, 'KmsSigningKeyArn', {
      value: this.signingKey.keyArn,
      description: 'KMS Signing Key ARN for zk-SNARK Telemetry Proofs',
    });

    new cdk.CfnOutput(this, 'HttpApiUrl', {
      value: this.httpApi.url || '',
      description: 'API Gateway HTTP API base URL',
    });
  }
}
