#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BackendStack } from '../lib/BackendStack';
import { EmailStack } from '../lib/EmailStack';

// TODO remove dev host names from traefik/letsencrypt/acme.json and take a new snapshot

const app = new cdk.App();
new BackendStack(app, 'beddybytes-backend', {
  deploy_env: 'prod',

  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: '123456789012', region: 'us-east-1' },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});

new BackendStack(app, 'beddybytes-backend-staging', {
  deploy_env: 'staging',
  // - if using the EBS snapshot from prod the traefik ecs cluster will need to be update
  //   - /ebs/persistent/traefik/traefik.yml
  //   - providers.ecs.clusters: beddybytes-backend-staging-cluster
  // - need to push an image to the staging ECR repo (scripts/backend/copy.sh)
  // - update the secrets
});

new EmailStack(app, 'beddybytes-email');