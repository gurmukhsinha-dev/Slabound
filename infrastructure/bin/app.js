#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const cdk = require("aws-cdk-lib");
const slabound_stack_1 = require("../lib/slabound-stack");
const app = new cdk.App();
const env = process.env.CDK_DEFAULT_ACCOUNT
    ? {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
    }
    : undefined;
new slabound_stack_1.SLABoundStack(app, 'SLABoundStack', {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLHVDQUFxQztBQUNyQyxtQ0FBbUM7QUFDbkMsMERBQXNEO0FBRXRELE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRTFCLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO0lBQ3pDLENBQUMsQ0FBQztRQUNFLE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQjtRQUN4QyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxXQUFXO0tBQ3REO0lBQ0gsQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUVkLElBQUksOEJBQWEsQ0FBQyxHQUFHLEVBQUUsZUFBZSxFQUFFO0lBQ3RDLFNBQVMsRUFBRSw2QkFBNkI7SUFDeEMsV0FBVyxFQUFFLDZGQUE2RjtJQUMxRyxHQUFHO0lBQ0gsSUFBSSxFQUFFO1FBQ0osT0FBTyxFQUFFLFVBQVU7UUFDbkIsV0FBVyxFQUFFLFlBQVk7UUFDekIsU0FBUyxFQUFFLFNBQVM7S0FDckI7Q0FDRixDQUFDLENBQUM7QUFFSCxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG5pbXBvcnQgJ3NvdXJjZS1tYXAtc3VwcG9ydC9yZWdpc3Rlcic7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgU0xBQm91bmRTdGFjayB9IGZyb20gJy4uL2xpYi9zbGFib3VuZC1zdGFjayc7XG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5cbmNvbnN0IGVudiA9IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlRcbiAgPyB7XG4gICAgICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxuICAgICAgcmVnaW9uOiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgJ3VzLWVhc3QtMScsXG4gICAgfVxuICA6IHVuZGVmaW5lZDtcblxubmV3IFNMQUJvdW5kU3RhY2soYXBwLCAnU0xBQm91bmRTdGFjaycsIHtcbiAgc3RhY2tOYW1lOiAnc2xhYm91bmQtYXJiaXRyYXRpb24tZW5naW5lJyxcbiAgZGVzY3JpcHRpb246ICdTTEFCb3VuZDogQXV0b25vbW91cyBBUEkgU0xBIEFyYml0cmF0aW9uIEVuZ2luZSAoQVdTIEJlZHJvY2ssIE5lcHR1bmUsIExhbWJkYSwgRUNTIEZhcmdhdGUpJyxcbiAgZW52LFxuICB0YWdzOiB7XG4gICAgUHJvamVjdDogJ1NMQUJvdW5kJyxcbiAgICBFbnZpcm9ubWVudDogJ1Byb2R1Y3Rpb24nLFxuICAgIE1hbmFnZWRCeTogJ0FXUy1DREsnLFxuICB9LFxufSk7XG5cbmFwcC5zeW50aCgpO1xuIl19