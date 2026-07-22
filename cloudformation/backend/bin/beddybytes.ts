#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CoreStack } from '../lib/CoreStack';
import { SecretsStack } from '../lib/SecretsStack';
import { EmailStack } from '../lib/EmailStack';
import { ContinuousIntegrationStack } from '../lib/ContinuousIntegrationStack';
import { LoadBalancerStack } from '../lib/LoadBalancerStack';
import { MonitoringStack } from '../lib/MonitoringStack';
import { BackendStack } from '../lib/BackendStack';

// TODO remove dev host names from traefik/letsencrypt/acme.json and take a new snapshot

const app = new cdk.App();

const core_stack = new CoreStack(app, 'beddybytes-core');

const secrets_stack = new SecretsStack(app, 'beddybytes-secrets');

const ci_stack = new ContinuousIntegrationStack(app, 'beddybytes-ci');

const monitoring_stack = new MonitoringStack(app, 'beddybytes-monitoring', {
  cluster: core_stack.cluster,
  elastic_ip: core_stack.elastic_ip,
  tinyanalytics_docker_repository: ci_stack.tinyanalytics_docker_repository,
  tinyanalytics_docker_image_digest: 'sha256:771ae33a04a6cb1264c43602456c2efeea04e40df892412d880a7b5c1240a2e5',
  tinyanalytics_token_signing_key: secrets_stack.tinyanalytics_token_signing_key,
});

const load_balancer_stack = new LoadBalancerStack(app, 'beddybytes-load-balancer', {
  cluster: core_stack.cluster,
  influxdb_container: monitoring_stack.influxdb_container,
});

new BackendStack(app, 'beddybytes-backend-prod', {
  deploy_env: 'prod',
  docker_repository: ci_stack.docker_repository,
  docker_image_digest: 'sha256:a0cb92e4c302916898db2abb1f4bb5500f0fc3db8f3853a93b1b5d07063eff42',
  iot_authorizer_sha: 'd02e1ad2414b6a1f29406a5a8bd8d3257af535593da74e4db76b2671347abdb6',
  cluster: core_stack.cluster,
  signing_key: secrets_stack.signing_key,
  elastic_ip: core_stack.elastic_ip,
  bucket: core_stack.bucket,
});

new BackendStack(app, 'beddybytes-backend-qa', {
  deploy_env: 'qa',
  docker_repository: ci_stack.docker_repository,
  docker_image_digest: 'sha256:a0cb92e4c302916898db2abb1f4bb5500f0fc3db8f3853a93b1b5d07063eff42',
  iot_authorizer_sha: 'd02e1ad2414b6a1f29406a5a8bd8d3257af535593da74e4db76b2671347abdb6',
  cluster: core_stack.cluster,
  signing_key: secrets_stack.signing_key,
  elastic_ip: core_stack.elastic_ip,
  bucket: core_stack.bucket,
});

new EmailStack(app, 'beddybytes-email');
