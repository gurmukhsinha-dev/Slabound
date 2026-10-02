"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SLABoundStack = void 0;
const cdk = require("aws-cdk-lib");
const ec2 = require("aws-cdk-lib/aws-ec2");
const s3 = require("aws-cdk-lib/aws-s3");
const s3notifications = require("aws-cdk-lib/aws-s3-notifications");
const lambda = require("aws-cdk-lib/aws-lambda");
const iam = require("aws-cdk-lib/aws-iam");
const kms = require("aws-cdk-lib/aws-kms");
const neptune = require("aws-cdk-lib/aws-neptune");
const ecs = require("aws-cdk-lib/aws-ecs");
const apigwv2 = require("aws-cdk-lib/aws-apigatewayv2");
const apigwv2_integrations = require("aws-cdk-lib/aws-apigatewayv2-integrations");
const path = require("path");
const fs = require("fs");
function resolvePath(relativeToRoot) {
    const p1 = path.resolve(__dirname, '..', relativeToRoot);
    if (fs.existsSync(p1))
        return p1;
    const p2 = path.resolve(__dirname, '../..', relativeToRoot);
    if (fs.existsSync(p2))
        return p2;
    return p1;
}
class SLABoundStack extends cdk.Stack {
    vpc;
    contractsBucket;
    signingKey;
    neptuneCluster;
    contractCompilerLambda;
    zkTelemetryProverLambda;
    fargateTaskDefinition;
    httpApi;
    constructor(scope, id, props) {
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
        neptuneSecurityGroup.addIngressRule(lambdaSecurityGroup, ec2.Port.tcp(8182), 'Allow Gremlin traffic from Lambda Compiler');
        neptuneSecurityGroup.addIngressRule(fargateSecurityGroup, ec2.Port.tcp(8182), 'Allow Gremlin traffic from Fargate Arbitration Agent');
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
        contractCompilerRole.addToPolicy(new iam.PolicyStatement({
            actions: ['s3:GetObject'],
            resources: [`${this.contractsBucket.bucketArn}/*`],
        }));
        // bedrock:InvokeModel on arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet*
        contractCompilerRole.addToPolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel'],
            resources: [
                `arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet*`,
            ],
        }));
        // neptune-db:connect on arn:aws:neptune-db:us-east-1:*:*/*
        contractCompilerRole.addToPolicy(new iam.PolicyStatement({
            actions: ['neptune-db:connect', 'neptune-db:WriteData'],
            resources: [`arn:aws:neptune-db:${region}:${account}:*/*`],
        }));
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
        this.contractsBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3notifications.LambdaDestination(this.contractCompilerLambda), { suffix: '.pdf' });
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
        zkTelemetryProverRole.addToPolicy(new iam.PolicyStatement({
            actions: ['cloudwatch:GetMetricData'],
            resources: ['*'],
        }));
        // kms:Sign, kms:GetPublicKey on arn:aws:kms:us-east-1:*:key/slabound-signing-key
        zkTelemetryProverRole.addToPolicy(new iam.PolicyStatement({
            actions: ['kms:Sign', 'kms:GetPublicKey'],
            resources: [this.signingKey.keyArn],
        }));
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
        fargateTaskRole.addToPolicy(new iam.PolicyStatement({
            actions: ['neptune-db:ReadDataAccess', 'neptune-db:connect'],
            resources: [`arn:aws:neptune-db:${region}:${account}:*/*`],
        }));
        // secretsmanager:GetSecretValue on arn:aws:secretsmanager:*:*:secret:slabound/vendor-keys-*
        fargateTaskRole.addToPolicy(new iam.PolicyStatement({
            actions: ['secretsmanager:GetSecretValue'],
            resources: [`arn:aws:secretsmanager:${region}:${account}:secret:slabound/vendor-keys-*`],
        }));
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
        const zkIntegration = new apigwv2_integrations.HttpLambdaIntegration('zkProverIntegration', this.zkTelemetryProverLambda);
        const compilerIntegration = new apigwv2_integrations.HttpLambdaIntegration('compilerIntegration', this.contractCompilerLambda);
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
exports.SLABoundStack = SLABoundStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2xhYm91bmQtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzbGFib3VuZC1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBbUM7QUFFbkMsMkNBQTJDO0FBQzNDLHlDQUF5QztBQUN6QyxvRUFBb0U7QUFDcEUsaURBQWlEO0FBQ2pELDJDQUEyQztBQUMzQywyQ0FBMkM7QUFDM0MsbURBQW1EO0FBQ25ELDJDQUEyQztBQUMzQyx3REFBd0Q7QUFDeEQsa0ZBQWtGO0FBQ2xGLDZCQUE2QjtBQUM3Qix5QkFBeUI7QUFFekIsU0FBUyxXQUFXLENBQUMsY0FBc0I7SUFDekMsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLGNBQWMsQ0FBQyxDQUFDO0lBQ3pELElBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7UUFBRSxPQUFPLEVBQUUsQ0FBQztJQUNqQyxNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxPQUFPLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFDNUQsSUFBSSxFQUFFLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztRQUFFLE9BQU8sRUFBRSxDQUFDO0lBQ2pDLE9BQU8sRUFBRSxDQUFDO0FBQ1osQ0FBQztBQUVELE1BQWEsYUFBYyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzFCLEdBQUcsQ0FBVTtJQUNiLGVBQWUsQ0FBWTtJQUMzQixVQUFVLENBQVU7SUFDcEIsY0FBYyxDQUF1QjtJQUNyQyxzQkFBc0IsQ0FBa0I7SUFDeEMsdUJBQXVCLENBQWtCO0lBQ3pDLHFCQUFxQixDQUE0QjtJQUNqRCxPQUFPLENBQWtCO0lBRXpDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxNQUFNLEdBQUcsSUFB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ZUFBZTtZQUNyQixPQUFPLEVBQUUsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQztZQUMxRCxXQUFXLEVBQUUsYUFBYTtTQUMzQixDQUFDLENBQUM7UUFFSCw0RUFBNEU7UUFDNUUsb0JBQW9CO1FBQ3BCLDRFQUE0RTtRQUM1RSxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQzdDLEtBQUssRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLFVBQVU7WUFDdEMsV0FBVyxFQUFFLDZDQUE2QztTQUMzRCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQ3pDLEtBQUssRUFBRSxlQUFlO1lBQ3RCLFdBQVcsRUFBRSxpQ0FBaUM7U0FDL0MsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUMxQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNO1lBQzdCLFdBQVcsRUFBRSxtREFBbUQ7U0FDakUsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDcEMsS0FBSyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxJQUFJLEVBQUU7WUFDN0IsV0FBVyxFQUFFLCtCQUErQjtTQUM3QyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF6V0Qsc0NBeVdDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIHMzbm90aWZpY2F0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMtbm90aWZpY2F0aW9ucyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBrbXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWttcyc7XG5pbXBvcnQgKiBhcyBuZXB0dW5lIGZyb20gJ2F3cy1jZGstbGliL2F3cy1uZXB0dW5lJztcbmltcG9ydCAqIGFzIGVjcyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWNzJztcbmltcG9ydCAqIGFzIGFwaWd3djIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXl2Mic7XG5pbXBvcnQgKiBhcyBhcGlnd3YyX2ludGVncmF0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheXYyLWludGVncmF0aW9ucyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuXG5mdW5jdGlvbiByZXNvbHZlUGF0aChyZWxhdGl2ZVRvUm9vdDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgcDEgPSBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi4nLCByZWxhdGl2ZVRvUm9vdCk7XG4gIGlmIChmcy5leGlzdHNTeW5jKHAxKSkgcmV0dXJuIHAxO1xuICBjb25zdCBwMiA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLi8uLicsIHJlbGF0aXZlVG9Sb290KTtcbiAgaWYgKGZzLmV4aXN0c1N5bmMocDIpKSByZXR1cm4gcDI7XG4gIHJldHVybiBwMTtcbn1cblxuZXhwb3J0IGNsYXNzIFNMQUJvdW5kU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgdnBjOiBlYzIuVnBjO1xuICBwdWJsaWMgcmVhZG9ubHkgY29udHJhY3RzQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBzaWduaW5nS2V5OiBrbXMuS2V5O1xuICBwdWJsaWMgcmVhZG9ubHkgbmVwdHVuZUNsdXN0ZXI6IG5lcHR1bmUuQ2ZuREJDbHVzdGVyO1xuICBwdWJsaWMgcmVhZG9ubHkgY29udHJhY3RDb21waWxlckxhbWJkYTogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgemtUZWxlbWV0cnlQcm92ZXJMYW1iZGE6IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGZhcmdhdGVUYXNrRGVmaW5pdGlvbjogZWNzLkZhcmdhdGVUYXNrRGVmaW5pdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGh0dHBBcGk6IGFwaWd3djIuSHR0cEFwaTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCByZWdpb24gPSB0aGlzLnJlZ2lvbiB8fCAndXMtZWFzdC0xJztcbiAgICBjb25zdCBhY2NvdW50ID0gdGhpcy5hY2NvdW50IHx8ICcqJztcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyAxLiBOZXR3b3JraW5nOiBJc29sYXRlZCBWUEMgKDIgUHVibGljLCAyIFByaXZhdGUgU3VibmV0cyBhY3Jvc3MgMiBBWnMpXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHRoaXMudnBjID0gbmV3IGVjMi5WcGModGhpcywgJ1NMQUJvdW5kVlBDJywge1xuICAgICAgbWF4QXpzOiAyLFxuICAgICAgbmF0R2F0ZXdheXM6IDEsIC8vIEhpZ2ggYXZhaWxhYmlsaXR5IHdpdGggY29zdC1lZmZpY2llbmN5IGZvciBkZXYvcHJvZFxuICAgICAgc3VibmV0Q29uZmlndXJhdGlvbjogW1xuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogJ1B1YmxpY1N1Ym5ldCcsXG4gICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFVCTElDLFxuICAgICAgICAgIGNpZHJNYXNrOiAyNCxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6ICdQcml2YXRlU3VibmV0JyxcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTLFxuICAgICAgICAgIGNpZHJNYXNrOiAyNCxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gMi4gU2VjdXJpdHkgR3JvdXBzXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGNvbnN0IG5lcHR1bmVTZWN1cml0eUdyb3VwID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdOZXB0dW5lU2VjdXJpdHlHcm91cCcsIHtcbiAgICAgIHZwYzogdGhpcy52cGMsXG4gICAgICBzZWN1cml0eUdyb3VwTmFtZTogJ3NsYWJvdW5kLW5lcHR1bmUtYWNjZXNzJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJpdHkgZ3JvdXAgaXNvbGF0aW5nIEFtYXpvbiBOZXB0dW5lIEdyYXBoIERCIGNsdXN0ZXInLFxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogZmFsc2UsXG4gICAgfSk7XG5cbiAgICBjb25zdCBsYW1iZGFTZWN1cml0eUdyb3VwID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdMYW1iZGFTZWN1cml0eUdyb3VwJywge1xuICAgICAgdnBjOiB0aGlzLnZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXBOYW1lOiAnc2xhYm91bmQtbGFtYmRhLWFjY2VzcycsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IGdyb3VwIGZvciBTTEFCb3VuZCBMYW1iZGEgZnVuY3Rpb25zJyxcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICBjb25zdCBmYXJnYXRlU2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnRmFyZ2F0ZVNlY3VyaXR5R3JvdXAnLCB7XG4gICAgICB2cGM6IHRoaXMudnBjLFxuICAgICAgc2VjdXJpdHlHcm91cE5hbWU6ICdzbGFib3VuZC1mYXJnYXRlLWFjY2VzcycsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IGdyb3VwIGZvciBTTEFCb3VuZCBGYXJnYXRlIEFyYml0cmF0aW9uIEFnZW50JyxcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBBbGxvdyBHcmVtbGluIHBvcnQgKDgxODIpIGluZ3Jlc3MgdG8gTmVwdHVuZSBmcm9tIExhbWJkYSBhbmQgRmFyZ2F0ZVxuICAgIG5lcHR1bmVTZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGVjMi5Qb3J0LnRjcCg4MTgyKSxcbiAgICAgICdBbGxvdyBHcmVtbGluIHRyYWZmaWMgZnJvbSBMYW1iZGEgQ29tcGlsZXInXG4gICAgKTtcbiAgICBuZXB0dW5lU2VjdXJpdHlHcm91cC5hZGRJbmdyZXNzUnVsZShcbiAgICAgIGZhcmdhdGVTZWN1cml0eUdyb3VwLFxuICAgICAgZWMyLlBvcnQudGNwKDgxODIpLFxuICAgICAgJ0FsbG93IEdyZW1saW4gdHJhZmZpYyBmcm9tIEZhcmdhdGUgQXJiaXRyYXRpb24gQWdlbnQnXG4gICAgKTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyAzLiBDcnlwdG9ncmFwaGljIEtNUyBTaWduaW5nIEtleSBmb3IgemstU05BUksgVGVsZW1ldHJ5IFByb29mc1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICB0aGlzLnNpZ25pbmdLZXkgPSBuZXcga21zLktleSh0aGlzLCAnU0xBQm91bmRTaWduaW5nS2V5Jywge1xuICAgICAga2V5U3BlYzoga21zLktleVNwZWMuUlNBXzIwNDgsXG4gICAgICBrZXlVc2FnZToga21zLktleVVzYWdlLlNJR05fVkVSSUZZLFxuICAgICAgZGVzY3JpcHRpb246ICdBc3ltbWV0cmljIFJTQV8yMDQ4IGtleSBmb3IgY3J5cHRvZ3JhcGhpYyBzaWduaW5nIG9mIHprLVNOQVJLIHRlbGVtZXRyeSBwcm9vZnMnLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGFsaWFzOiAnYWxpYXMvc2xhYm91bmQtc2lnbmluZy1rZXknLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIDQuIFMzIEJ1Y2tldCBmb3IgSW5jb21pbmcgU0xBIENvbnRyYWN0c1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICB0aGlzLmNvbnRyYWN0c0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0NvbnRyYWN0c0J1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBzbGFib3VuZC1jb250cmFjdHMtJHthY2NvdW50fWAsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgdmVyc2lvbmVkOiB0cnVlLFxuICAgICAgZW5mb3JjZVNTTDogdHJ1ZSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyA1LiBBbWF6b24gTmVwdHVuZSBHcmFwaCBEYXRhYmFzZSAoR3JlbWxpbiBTZXJ2ZXIpXG4gICAgLy8gQ29uZGl0aW9uYWw6IEVuYWJsZWQgb24gdXBncmFkZWQgYWNjb3VudHMgKERFUExPWV9ORVBUVU5FPXRydWUpLlxuICAgIC8vIEJ5cGFzc2VkIG9uIEFXUyBGcmVlIFBsYW4gYWNjb3VudHMgd2hlcmUgTmVwdHVuZSBpcyByZXN0cmljdGVkIGJ5IEFXUy5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgY29uc3QgZGVwbG95TmVwdHVuZSA9IHByb2Nlc3MuZW52LkRFUExPWV9ORVBUVU5FID09PSAndHJ1ZSc7XG4gICAgbGV0IG5lcHR1bmVFbmRwb2ludCA9ICdtb2NrLW5lcHR1bmUuc2xhYm91bmQubG9jYWwnO1xuXG4gICAgaWYgKGRlcGxveU5lcHR1bmUpIHtcbiAgICAgIGNvbnN0IG5lcHR1bmVTdWJuZXRHcm91cCA9IG5ldyBuZXB0dW5lLkNmbkRCU3VibmV0R3JvdXAodGhpcywgJ05lcHR1bmVTdWJuZXRHcm91cCcsIHtcbiAgICAgICAgZGJTdWJuZXRHcm91cERlc2NyaXB0aW9uOiAnUHJpdmF0ZSBTdWJuZXRzIGZvciBOZXB0dW5lIENsdXN0ZXInLFxuICAgICAgICBzdWJuZXRJZHM6IHRoaXMudnBjLnByaXZhdGVTdWJuZXRzLm1hcCgocykgPT4gcy5zdWJuZXRJZCksXG4gICAgICAgIGRiU3VibmV0R3JvdXBOYW1lOiBgc2xhYm91bmQtbmVwdHVuZS1zdWJuZXRzLSR7YWNjb3VudH1gLFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMubmVwdHVuZUNsdXN0ZXIgPSBuZXcgbmVwdHVuZS5DZm5EQkNsdXN0ZXIodGhpcywgJ05lcHR1bmVDbHVzdGVyJywge1xuICAgICAgICBkYlN1Ym5ldEdyb3VwTmFtZTogbmVwdHVuZVN1Ym5ldEdyb3VwLmRiU3VibmV0R3JvdXBOYW1lLFxuICAgICAgICB2cGNTZWN1cml0eUdyb3VwSWRzOiBbbmVwdHVuZVNlY3VyaXR5R3JvdXAuc2VjdXJpdHlHcm91cElkXSxcbiAgICAgICAgaWFtQXV0aEVuYWJsZWQ6IHRydWUsXG4gICAgICAgIHN0b3JhZ2VFbmNyeXB0ZWQ6IHRydWUsXG4gICAgICAgIGRlbGV0aW9uUHJvdGVjdGlvbjogZmFsc2UsXG4gICAgICB9KTtcbiAgICAgIHRoaXMubmVwdHVuZUNsdXN0ZXIuYWRkUmVzb3VyY2VEZXBlbmRlbmN5KG5lcHR1bmVTdWJuZXRHcm91cCk7XG5cbiAgICAgIGNvbnN0IG5lcHR1bmVJbnN0YW5jZSA9IG5ldyBuZXB0dW5lLkNmbkRCSW5zdGFuY2UodGhpcywgJ05lcHR1bmVJbnN0YW5jZScsIHtcbiAgICAgICAgZGJDbHVzdGVySWRlbnRpZmllcjogdGhpcy5uZXB0dW5lQ2x1c3Rlci5yZWYsXG4gICAgICAgIGRiSW5zdGFuY2VDbGFzczogJ2RiLnQzLm1lZGl1bScsXG4gICAgICAgIGF1dG9NaW5vclZlcnNpb25VcGdyYWRlOiB0cnVlLFxuICAgICAgfSk7XG4gICAgICBuZXB0dW5lSW5zdGFuY2UuYWRkUmVzb3VyY2VEZXBlbmRlbmN5KHRoaXMubmVwdHVuZUNsdXN0ZXIpO1xuXG4gICAgICBuZXB0dW5lRW5kcG9pbnQgPSB0aGlzLm5lcHR1bmVDbHVzdGVyLmF0dHJFbmRwb2ludDtcbiAgICB9XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gNi4gQ29udHJhY3RUb0VDQUNvbXBpbGVyIExhbWJkYSBGdW5jdGlvblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBjb25zdCBjb250cmFjdENvbXBpbGVyUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnQ29udHJhY3RDb21waWxlckxhbWJkYVJvbGUnLCB7XG4gICAgICByb2xlTmFtZTogJ0NvbnRyYWN0Q29tcGlsZXJMYW1iZGFSb2xlJyxcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYVZQQ0FjY2Vzc0V4ZWN1dGlvblJvbGUnKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBMZWFzdCBQcml2aWxlZ2UgSUFNIHBlciBTZWN1cml0eSAmIEFjY2VzcyBEb2N1bWVudDpcbiAgICAvLyBzMzpHZXRPYmplY3Qgb24gYXJuOmF3czpzMzo6OnNsYWJvdW5kLWNvbnRyYWN0cy1pbmNvbWluZy8qXG4gICAgY29udHJhY3RDb21waWxlclJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGFjdGlvbnM6IFsnczM6R2V0T2JqZWN0J10sXG4gICAgICAgIHJlc291cmNlczogW2Ake3RoaXMuY29udHJhY3RzQnVja2V0LmJ1Y2tldEFybn0vKmBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gYmVkcm9jazpJbnZva2VNb2RlbCBvbiBhcm46YXdzOmJlZHJvY2s6Kjo6Zm91bmRhdGlvbi1tb2RlbC9hbnRocm9waWMuY2xhdWRlLTMtNS1zb25uZXQqXG4gICAgY29udHJhY3RDb21waWxlclJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGFjdGlvbnM6IFsnYmVkcm9jazpJbnZva2VNb2RlbCddLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICBgYXJuOmF3czpiZWRyb2NrOio6OmZvdW5kYXRpb24tbW9kZWwvYW50aHJvcGljLmNsYXVkZS0zLTUtc29ubmV0KmAsXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBuZXB0dW5lLWRiOmNvbm5lY3Qgb24gYXJuOmF3czpuZXB0dW5lLWRiOnVzLWVhc3QtMToqOiovKlxuICAgIGNvbnRyYWN0Q29tcGlsZXJSb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBhY3Rpb25zOiBbJ25lcHR1bmUtZGI6Y29ubmVjdCcsICduZXB0dW5lLWRiOldyaXRlRGF0YSddLFxuICAgICAgICByZXNvdXJjZXM6IFtgYXJuOmF3czpuZXB0dW5lLWRiOiR7cmVnaW9ufToke2FjY291bnR9OiovKmBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgdGhpcy5jb250cmFjdENvbXBpbGVyTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQ29udHJhY3RUb0VDQUNvbXBpbGVyJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiAnQ29udHJhY3RUb0VDQUNvbXBpbGVyJyxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxuICAgICAgaGFuZGxlcjogJ2NvbnRyYWN0X2NvbXBpbGVyLmxhbWJkYV9oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChyZXNvbHZlUGF0aCgnYmFja2VuZC9oYW5kbGVycycpKSxcbiAgICAgIHJvbGU6IGNvbnRyYWN0Q29tcGlsZXJSb2xlLFxuICAgICAgdnBjOiB0aGlzLnZwYyxcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyB9LFxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTZWN1cml0eUdyb3VwXSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICAgIG1lbW9yeVNpemU6IDEwMjQsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBORVBUVU5FX0VORFBPSU5UOiBuZXB0dW5lRW5kcG9pbnQsXG4gICAgICAgIE5FUFRVTkVfUE9SVDogJzgxODInLFxuICAgICAgICBCRURST0NLX01PREVMX0lEOiAnYW50aHJvcGljLmNsYXVkZS0zLTUtc29ubmV0LTIwMjQwNjIwLXYxOjAnLFxuICAgICAgICBBV1NfTk9ERUpTX0NPTk5FQ1RJT05fUkVVU0VfRU5BQkxFRDogJzEnLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFMzIEV2ZW50IE5vdGlmaWNhdGlvbjogVHJpZ2dlciBMYW1iZGEgdXBvbiBQREYgdXBsb2FkXG4gICAgdGhpcy5jb250cmFjdHNCdWNrZXQuYWRkRXZlbnROb3RpZmljYXRpb24oXG4gICAgICBzMy5FdmVudFR5cGUuT0JKRUNUX0NSRUFURUQsXG4gICAgICBuZXcgczNub3RpZmljYXRpb25zLkxhbWJkYURlc3RpbmF0aW9uKHRoaXMuY29udHJhY3RDb21waWxlckxhbWJkYSksXG4gICAgICB7IHN1ZmZpeDogJy5wZGYnIH1cbiAgICApO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIDcuIHprVGVsZW1ldHJ5UHJvdmVyIExhbWJkYSBGdW5jdGlvblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBjb25zdCB6a1RlbGVtZXRyeVByb3ZlclJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ3prVGVsZW1ldHJ5UHJvdmVyTGFtYmRhUm9sZScsIHtcbiAgICAgIHJvbGVOYW1lOiAnemtUZWxlbWV0cnlQcm92ZXJMYW1iZGFSb2xlJyxcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIExlYXN0IFByaXZpbGVnZSBJQU0gcGVyIFNlY3VyaXR5ICYgQWNjZXNzIERvY3VtZW50OlxuICAgIC8vIGNsb3Vkd2F0Y2g6R2V0TWV0cmljRGF0YVxuICAgIHprVGVsZW1ldHJ5UHJvdmVyUm9sZS5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgYWN0aW9uczogWydjbG91ZHdhdGNoOkdldE1ldHJpY0RhdGEnXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIGttczpTaWduLCBrbXM6R2V0UHVibGljS2V5IG9uIGFybjphd3M6a21zOnVzLWVhc3QtMToqOmtleS9zbGFib3VuZC1zaWduaW5nLWtleVxuICAgIHprVGVsZW1ldHJ5UHJvdmVyUm9sZS5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgYWN0aW9uczogWydrbXM6U2lnbicsICdrbXM6R2V0UHVibGljS2V5J10sXG4gICAgICAgIHJlc291cmNlczogW3RoaXMuc2lnbmluZ0tleS5rZXlBcm5dLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgdGhpcy56a1RlbGVtZXRyeVByb3ZlckxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ3prVGVsZW1ldHJ5UHJvdmVyJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiAnemtUZWxlbWV0cnlQcm92ZXInLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEsXG4gICAgICBoYW5kbGVyOiAnemtfdGVsZW1ldHJ5X3Byb3Zlci5sYW1iZGFfaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocmVzb2x2ZVBhdGgoJ2JhY2tlbmQvaGFuZGxlcnMnKSksXG4gICAgICByb2xlOiB6a1RlbGVtZXRyeVByb3ZlclJvbGUsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBLTVNfS0VZX0lEOiB0aGlzLnNpZ25pbmdLZXkua2V5SWQsXG4gICAgICAgIEtNU19LRVlfQVJOOiB0aGlzLnNpZ25pbmdLZXkua2V5QXJuLFxuICAgICAgICBNRVRSSUNfTkFNRVNQQUNFOiAnU0xBQm91bmQvU3ludGhldGljcycsXG4gICAgICAgIFdJTkRPV19TSVpFX01JTlVURVM6ICczJyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gOC4gQW1hem9uIEVDUyBGYXJnYXRlIFRhc2sgRGVmaW5pdGlvbjogU0xBQXJiaXRyYXRpb25BZ2VudFxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBjb25zdCBlY3NDbHVzdGVyID0gbmV3IGVjcy5DbHVzdGVyKHRoaXMsICdTTEFCb3VuZEVDU0NsdXN0ZXInLCB7XG4gICAgICB2cGM6IHRoaXMudnBjLFxuICAgICAgY2x1c3Rlck5hbWU6ICdzbGFib3VuZC1hcmJpdHJhdGlvbi1jbHVzdGVyJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGZhcmdhdGVUYXNrUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnRmFyZ2F0ZUFyYml0cmF0aW9uQWdlbnRSb2xlJywge1xuICAgICAgcm9sZU5hbWU6ICdGYXJnYXRlQXJiaXRyYXRpb25BZ2VudFJvbGUnLFxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2Vjcy10YXNrcy5hbWF6b25hd3MuY29tJyksXG4gICAgfSk7XG5cbiAgICAvLyBMZWFzdCBQcml2aWxlZ2UgSUFNIHBlciBTZWN1cml0eSAmIEFjY2VzcyBEb2N1bWVudDpcbiAgICAvLyBuZXB0dW5lLWRiOlJlYWREYXRhQWNjZXNzXG4gICAgZmFyZ2F0ZVRhc2tSb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBhY3Rpb25zOiBbJ25lcHR1bmUtZGI6UmVhZERhdGFBY2Nlc3MnLCAnbmVwdHVuZS1kYjpjb25uZWN0J10sXG4gICAgICAgIHJlc291cmNlczogW2Bhcm46YXdzOm5lcHR1bmUtZGI6JHtyZWdpb259OiR7YWNjb3VudH06Ki8qYF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBzZWNyZXRzbWFuYWdlcjpHZXRTZWNyZXRWYWx1ZSBvbiBhcm46YXdzOnNlY3JldHNtYW5hZ2VyOio6KjpzZWNyZXQ6c2xhYm91bmQvdmVuZG9yLWtleXMtKlxuICAgIGZhcmdhdGVUYXNrUm9sZS5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgYWN0aW9uczogWydzZWNyZXRzbWFuYWdlcjpHZXRTZWNyZXRWYWx1ZSddLFxuICAgICAgICByZXNvdXJjZXM6IFtgYXJuOmF3czpzZWNyZXRzbWFuYWdlcjoke3JlZ2lvbn06JHthY2NvdW50fTpzZWNyZXQ6c2xhYm91bmQvdmVuZG9yLWtleXMtKmBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgdGhpcy5mYXJnYXRlVGFza0RlZmluaXRpb24gPSBuZXcgZWNzLkZhcmdhdGVUYXNrRGVmaW5pdGlvbih0aGlzLCAnU0xBQXJiaXRyYXRpb25BZ2VudFRhc2snLCB7XG4gICAgICBmYW1pbHk6ICdTTEFBcmJpdHJhdGlvbkFnZW50JyxcbiAgICAgIGNwdTogNTEyLFxuICAgICAgbWVtb3J5TGltaXRNaUI6IDEwMjQsXG4gICAgICB0YXNrUm9sZTogZmFyZ2F0ZVRhc2tSb2xlLFxuICAgIH0pO1xuXG4gICAgY29uc3QgY29udGFpbmVySW1hZ2UgPSBwcm9jZXNzLmVudi5CVUlMRF9ET0NLRVJfQVNTRVQgPT09ICd0cnVlJ1xuICAgICAgPyBlY3MuQ29udGFpbmVySW1hZ2UuZnJvbUFzc2V0KHJlc29sdmVQYXRoKCdhZ2VudCcpKVxuICAgICAgOiBlY3MuQ29udGFpbmVySW1hZ2UuZnJvbVJlZ2lzdHJ5KCdwdWJsaWMuZWNyLmF3cy9kb2NrZXIvbGlicmFyeS9weXRob246My4xMS1zbGltJyk7XG5cbiAgICB0aGlzLmZhcmdhdGVUYXNrRGVmaW5pdGlvbi5hZGRDb250YWluZXIoJ0FyYml0cmF0aW9uQWdlbnRDb250YWluZXInLCB7XG4gICAgICBpbWFnZTogY29udGFpbmVySW1hZ2UsXG4gICAgICBsb2dnaW5nOiBlY3MuTG9nRHJpdmVycy5hd3NMb2dzKHsgc3RyZWFtUHJlZml4OiAnc2xhLWFyYml0cmF0aW9uLWFnZW50JyB9KSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIE5FUFRVTkVfRU5EUE9JTlQ6IG5lcHR1bmVFbmRwb2ludCxcbiAgICAgICAgTkVQVFVORV9QT1JUOiAnODE4MicsXG4gICAgICAgIEtNU19LRVlfSUQ6IHRoaXMuc2lnbmluZ0tleS5rZXlJZCxcbiAgICAgICAgU1RSSVBFX0RJU1BVVEVTX0VORFBPSU5UOiAnaHR0cHM6Ly9hcGkuc3RyaXBlLmNvbS92MS9kaXNwdXRlcycsXG4gICAgICAgIFpFTkRFU0tfVElDS0VUU19FTkRQT0lOVDogJ2h0dHBzOi8vc2xhYm91bmQuemVuZGVzay5jb20vYXBpL3YyL3RpY2tldHMuanNvbicsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIDkuIEFQSSBHYXRld2F5IEhUVFAgQVBJXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHRoaXMuaHR0cEFwaSA9IG5ldyBhcGlnd3YyLkh0dHBBcGkodGhpcywgJ1NMQUJvdW5kSHR0cEFwaScsIHtcbiAgICAgIGFwaU5hbWU6ICdTTEFCb3VuZCBBUEknLFxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgR2F0ZXdheSBmb3IgU0xBQm91bmQgQ29udHJhY3RzLCBUZWxlbWV0cnksIGFuZCBEaXNwdXRlcycsXG4gICAgICBjb3JzUHJlZmxpZ2h0OiB7XG4gICAgICAgIGFsbG93SGVhZGVyczogWydBdXRob3JpemF0aW9uJywgJ0NvbnRlbnQtVHlwZScsICd4LWFwaS1rZXknXSxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBbXG4gICAgICAgICAgYXBpZ3d2Mi5Db3JzSHR0cE1ldGhvZC5HRVQsXG4gICAgICAgICAgYXBpZ3d2Mi5Db3JzSHR0cE1ldGhvZC5QT1NULFxuICAgICAgICAgIGFwaWd3djIuQ29yc0h0dHBNZXRob2QuT1BUSU9OUyxcbiAgICAgICAgXSxcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgbWF4QWdlOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCB6a0ludGVncmF0aW9uID0gbmV3IGFwaWd3djJfaW50ZWdyYXRpb25zLkh0dHBMYW1iZGFJbnRlZ3JhdGlvbihcbiAgICAgICd6a1Byb3ZlckludGVncmF0aW9uJyxcbiAgICAgIHRoaXMuemtUZWxlbWV0cnlQcm92ZXJMYW1iZGFcbiAgICApO1xuXG4gICAgY29uc3QgY29tcGlsZXJJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnd3YyX2ludGVncmF0aW9ucy5IdHRwTGFtYmRhSW50ZWdyYXRpb24oXG4gICAgICAnY29tcGlsZXJJbnRlZ3JhdGlvbicsXG4gICAgICB0aGlzLmNvbnRyYWN0Q29tcGlsZXJMYW1iZGFcbiAgICApO1xuXG4gICAgLy8gRW5kcG9pbnRzOiAvYXBpL2NvbnRyYWN0cywgL2FwaS90ZWxlbWV0cnksIC9hcGkvZGlzcHV0ZXNcbiAgICB0aGlzLmh0dHBBcGkuYWRkUm91dGVzKHtcbiAgICAgIHBhdGg6ICcvYXBpL2NvbnRyYWN0cycsXG4gICAgICBtZXRob2RzOiBbYXBpZ3d2Mi5IdHRwTWV0aG9kLkdFVCwgYXBpZ3d2Mi5IdHRwTWV0aG9kLlBPU1RdLFxuICAgICAgaW50ZWdyYXRpb246IGNvbXBpbGVySW50ZWdyYXRpb24sXG4gICAgfSk7XG5cbiAgICB0aGlzLmh0dHBBcGkuYWRkUm91dGVzKHtcbiAgICAgIHBhdGg6ICcvYXBpL3RlbGVtZXRyeScsXG4gICAgICBtZXRob2RzOiBbYXBpZ3d2Mi5IdHRwTWV0aG9kLkdFVCwgYXBpZ3d2Mi5IdHRwTWV0aG9kLlBPU1RdLFxuICAgICAgaW50ZWdyYXRpb246IHprSW50ZWdyYXRpb24sXG4gICAgfSk7XG5cbiAgICB0aGlzLmh0dHBBcGkuYWRkUm91dGVzKHtcbiAgICAgIHBhdGg6ICcvYXBpL2Rpc3B1dGVzJyxcbiAgICAgIG1ldGhvZHM6IFthcGlnd3YyLkh0dHBNZXRob2QuR0VULCBhcGlnd3YyLkh0dHBNZXRob2QuUE9TVF0sXG4gICAgICBpbnRlZ3JhdGlvbjogemtJbnRlZ3JhdGlvbixcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyAxMC4gU3RhY2sgT3V0cHV0c1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ29udHJhY3RzQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmNvbnRyYWN0c0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdTMyBCdWNrZXQgZm9yIGluY29taW5nIHZlbmRvciBTTEEgY29udHJhY3RzJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdOZXB0dW5lRW5kcG9pbnQnLCB7XG4gICAgICB2YWx1ZTogbmVwdHVuZUVuZHBvaW50LFxuICAgICAgZGVzY3JpcHRpb246ICdBbWF6b24gTmVwdHVuZSBHcmVtbGluIEVuZHBvaW50JyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdLbXNTaWduaW5nS2V5QXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMuc2lnbmluZ0tleS5rZXlBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0tNUyBTaWduaW5nIEtleSBBUk4gZm9yIHprLVNOQVJLIFRlbGVtZXRyeSBQcm9vZnMnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0h0dHBBcGlVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5odHRwQXBpLnVybCB8fCAnJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIEdhdGV3YXkgSFRUUCBBUEkgYmFzZSBVUkwnLFxuICAgIH0pO1xuICB9XG59XG4iXX0=