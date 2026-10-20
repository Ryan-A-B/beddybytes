#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CoreStack } from '../lib/CoreStack';
import { SecretsStack } from '../lib/SecretsStack';
import { EmailStack } from '../lib/EmailStack';
import { ContinuousIntegrationStack } from '../lib/ContinuousIntegrationStack';
import { LoadBalancerStack } from '../lib/LoadBalancerStack';
import { MonitoringStack } from '../lib/MonitoringStack';
import { BackendStack } from '../lib/BackendStack';
import { LocalStack } from '../lib/LocalStack';

// TODO remove dev host names from traefik/letsencrypt/acme.json and take a new snapshot

const app = new cdk.App();

const core_stack = new CoreStack(app, 'beddybytes-core');

const secrets_stack = new SecretsStack(app, 'beddybytes-secrets');

const ci_stack = new ContinuousIntegrationStack(app, 'beddybytes-ci');

const monitoring_stack = new MonitoringStack(app, 'beddybytes-monitoring', {
  cluster: core_stack.cluster,
  elastic_ip: core_stack.elastic_ip,
  tinyanalytics_docker_repository: ci_stack.tinyanalytics_docker_repository,
  tinyanalytics_docker_image_digest: 'sha256:8dce83c23e48987a1a2831474e8555761a18951fee507b9f7c43c010de94e601',
  tinyanalytics_token_signing_key: secrets_stack.tinyanalytics_token_signing_key,
});

const load_balancer_stack = new LoadBalancerStack(app, 'beddybytes-load-balancer', {
  cluster: core_stack.cluster,
  influxdb_container: monitoring_stack.influxdb_container,
});

new BackendStack(app, 'beddybytes-backend-prod', {
  deploy_env: 'prod',
  docker_repository: ci_stack.docker_repository,
  docker_image_digest: 'sha256:b006d90d077d4187b7714ec1bebd9e54a99eb54f68fc23915c35742f1c3fc718',
  iot_authorizer_sha: '103066f58b7587791e9ea15f5fc1387f665c38790dc7705574f7c6aae513a538',
  cluster: core_stack.cluster,
  secrets_bundle: secrets_stack.backend_bundles.prod,
  elastic_ip: core_stack.elastic_ip,
  bucket: core_stack.bucket,
  trial_duration: 7 * 24 + 'h',
});

new BackendStack(app, 'beddybytes-backend-qa', {
  deploy_env: 'qa',
  docker_repository: ci_stack.docker_repository,
  docker_image_digest: 'sha256:c0edb3f2f97e85cb5a136935fc80c93c76e6b3423e0f7b3bcdec7aef7ad7edc9',
  iot_authorizer_sha: 'f34a48664ad637c0c3d7a77821a17357d26d0b9936f31b6300ef96ac215fe05d',
  cluster: core_stack.cluster,
  secrets_bundle: secrets_stack.backend_bundles.qa,
  elastic_ip: core_stack.elastic_ip,
  bucket: core_stack.bucket,
  trial_duration: '2h',
});

new LocalStack(app, 'beddybytes-backend-local', {
  elastic_ip: core_stack.elastic_ip,
});

new EmailStack(app, 'beddybytes-email');
