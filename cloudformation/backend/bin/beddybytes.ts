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
  docker_image_digest: 'sha256:de7bf9d6b55579f934d6f37483bd1f7a9c6e02e8c5525a558b8cff895e3a332d',
  iot_authorizer_sha: 'bda13d3030a66d70cbfb96c8e2e03ead6923e6c340c8e2f3cfcb2c3049a0ff99',
  cluster: core_stack.cluster,
  secrets_bundle: secrets_stack.backend_bundles.prod,
  elastic_ip: core_stack.elastic_ip,
  bucket: core_stack.bucket,
  trial_duration: 7 * 24 + 'h',
});

new BackendStack(app, 'beddybytes-backend-qa', {
  deploy_env: 'qa',
  docker_repository: ci_stack.docker_repository,
  docker_image_digest: 'sha256:de7bf9d6b55579f934d6f37483bd1f7a9c6e02e8c5525a558b8cff895e3a332d',
  iot_authorizer_sha: 'bda13d3030a66d70cbfb96c8e2e03ead6923e6c340c8e2f3cfcb2c3049a0ff99',
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
